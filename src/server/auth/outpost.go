package auth

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Outpost's login gateway logs the user in, then proxies each request to us
// with the user in X-Outpost-* headers and an Ed25519-signed JWT in
// X-Outpost-Identity. The plain headers are not trusted here: yarr listens on
// loopback, and any process on the machine can connect and send whatever
// headers it likes. Only the signed token is.

const identityHeader = "X-Outpost-Identity"

const (
	// The gateway mints tokens valid for 60s; allow for clocks that are a
	// little apart.
	clockSkew = 10 * time.Second
	// The gateway serves its keys with max-age=300 and keeps a rotated key
	// published for a day, so five minutes picks up a rotation in good time.
	jwksMaxAge = 5 * time.Minute
	// An unknown kid triggers a refetch, but no more often than this, so a
	// stream of forged tokens cannot turn into a stream of fetches.
	jwksMinRefetch = 30 * time.Second
	jwksTimeout    = 2 * time.Second
	jwksMaxBody    = 64 << 10
)

// Identity is the user the gateway vouched for.
type Identity struct {
	User   string
	Name   string
	Email  string
	Groups []string
}

// Gateway verifies identity tokens from Outpost's login gateway.
type Gateway struct {
	// Issuer is $OUTPOST_ISSUER; a token from anyone else is refused.
	Issuer string
	// JWKSURL is $OUTPOST_JWKS_URL, where the public keys are published.
	JWKSURL string
	// Audience, when set, is the only host a token may be addressed to.
	// When empty, the token must be addressed to the host the request was
	// made to, which the gateway passes through unchanged.
	Audience string

	Client *http.Client
	Now    func() time.Time

	mu        sync.Mutex
	keys      map[string]ed25519.PublicKey
	fetchedAt time.Time
	triedAt   time.Time
}

type identityClaims struct {
	Iss    string   `json:"iss"`
	Aud    string   `json:"aud"`
	Sub    string   `json:"sub"`
	Name   string   `json:"name"`
	Email  string   `json:"email"`
	Groups []string `json:"groups"`
	Iat    int64    `json:"iat"`
	Exp    int64    `json:"exp"`
}

func (g *Gateway) now() time.Time {
	if g.Now != nil {
		return g.Now()
	}
	return time.Now()
}

// Verify returns the user a request carries a valid identity token for.
func (g *Gateway) Verify(req *http.Request) (Identity, bool) {
	if g == nil {
		return Identity{}, false
	}
	token := req.Header.Get(identityHeader)
	if token == "" {
		return Identity{}, false
	}
	claims, err := g.verifyToken(token, g.audience(req))
	if err != nil {
		log.Printf("outpost: refused identity token: %v", err)
		return Identity{}, false
	}
	return Identity{User: claims.Sub, Name: claims.Name, Email: claims.Email, Groups: claims.Groups}, true
}

func (g *Gateway) audience(req *http.Request) string {
	if g.Audience != "" {
		return g.Audience
	}
	// The gateway's aud carries no port, the Host it forwards may.
	host := req.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return host
}

func (g *Gateway) verifyToken(token, audience string) (*identityClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed token")
	}
	enc := base64.RawURLEncoding

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	raw, err := enc.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("malformed header")
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return nil, fmt.Errorf("malformed header")
	}
	// Pinned rather than taken from the header, so "none" or an HMAC
	// algorithm keyed with the public key can never be smuggled in.
	if header.Alg != "EdDSA" {
		return nil, fmt.Errorf("unexpected alg %q", header.Alg)
	}
	sig, err := enc.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("malformed signature")
	}
	key, err := g.key(header.Kid)
	if err != nil {
		return nil, err
	}
	if !ed25519.Verify(key, []byte(parts[0]+"."+parts[1]), sig) {
		return nil, fmt.Errorf("bad signature")
	}

	var claims identityClaims
	raw, err = enc.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("malformed claims")
	}
	if err := json.Unmarshal(raw, &claims); err != nil {
		return nil, fmt.Errorf("malformed claims")
	}
	now := g.now()
	switch {
	case claims.Iss != g.Issuer:
		return nil, fmt.Errorf("issuer %q, want %q", claims.Iss, g.Issuer)
	case !strings.EqualFold(claims.Aud, audience):
		return nil, fmt.Errorf("audience %q, want %q", claims.Aud, audience)
	case claims.Sub == "":
		return nil, fmt.Errorf("no subject")
	case now.After(time.Unix(claims.Exp, 0).Add(clockSkew)):
		return nil, fmt.Errorf("expired")
	case now.Add(clockSkew).Before(time.Unix(claims.Iat, 0)):
		return nil, fmt.Errorf("issued in the future")
	}
	return &claims, nil
}

// key returns the public key for kid, fetching the key set when it is stale
// or does not know kid.
func (g *Gateway) key(kid string) (ed25519.PublicKey, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := g.now()
	key, known := g.keys[kid]
	stale := now.Sub(g.fetchedAt) >= jwksMaxAge
	if known && !stale {
		return key, nil
	}
	if now.Sub(g.triedAt) >= jwksMinRefetch || g.triedAt.IsZero() {
		g.triedAt = now
		keys, err := g.fetchKeys()
		if err != nil {
			// Keep serving with the keys we have: a gateway restart should
			// not log everyone out of yarr.
			log.Printf("outpost: fetching %s: %v", g.JWKSURL, err)
		} else {
			g.keys = keys
			g.fetchedAt = now
		}
	}
	if key, ok := g.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("unknown key %q", kid)
}

func (g *Gateway) fetchKeys() (map[string]ed25519.PublicKey, error) {
	client := g.Client
	if client == nil {
		client = &http.Client{Timeout: jwksTimeout}
	}
	resp, err := client.Get(g.JWKSURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, jwksMaxBody))
	if err != nil {
		return nil, err
	}
	var set struct {
		Keys []struct {
			Kty string `json:"kty"`
			Crv string `json:"crv"`
			X   string `json:"x"`
			Kid string `json:"kid"`
		} `json:"keys"`
	}
	if err := json.Unmarshal(body, &set); err != nil {
		return nil, err
	}
	keys := make(map[string]ed25519.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		if k.Kty != "OKP" || k.Crv != "Ed25519" {
			continue
		}
		x, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil || len(x) != ed25519.PublicKeySize {
			continue
		}
		keys[k.Kid] = ed25519.PublicKey(x)
	}
	if len(keys) == 0 {
		return nil, fmt.Errorf("no Ed25519 keys")
	}
	return keys, nil
}

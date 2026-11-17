package server

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/nkanaev/yarr/src/server/router"
)

const (
	// outpostKeysTTL matches the Cache-Control Outpost serves its JWKS with,
	// so a rotated key is picked up well inside its day of grace.
	outpostKeysTTL = 5 * time.Minute
	// outpostRefetchGap bounds how often a token naming an unknown key can
	// make yarr fetch the JWKS again, so forged kids can't turn yarr into a
	// request loop against the gateway.
	outpostRefetchGap = 10 * time.Second
	// outpostLeeway absorbs clock skew between the gateway and yarr. Both
	// run on one machine, so it can be small.
	outpostLeeway = 5 * time.Second
	// outpostJWKSLimit caps the JWKS body; a handful of keys is a few
	// hundred bytes.
	outpostJWKSLimit = 64 << 10
)

var (
	errNoIdentity      = errors.New("no X-Outpost-Identity header")
	errKeysUnavailable = errors.New("outpost signing keys unavailable")
)

// OutpostVerifier checks the X-Outpost-Identity token Outpost's login
// gateway puts on every request it lets through (Outpost service spec,
// section 3). yarr's port is on loopback, and the gateway is not the only
// thing on the machine: without this, any local process could connect
// directly and act as the user.
type OutpostVerifier struct {
	// Issuer is OUTPOST_ISSUER, the token's iss.
	Issuer string
	// JWKSURL is OUTPOST_JWKS_URL, where the public keys are published.
	JWKSURL string
	// Hosts, when set, are the only names yarr accepts as the token's aud.
	// Unset, aud must be the host the request was sent to, which stops a
	// process holding no token but not one replaying a token a sibling
	// service was handed.
	Hosts []string

	Client *http.Client
	now    func() time.Time

	mu          sync.Mutex
	keys        map[string]ed25519.PublicKey
	fetched     time.Time
	lastAttempt time.Time
	lastLog     time.Time
}

// NewOutpostVerifier makes a verifier for the given issuer and JWKS URL.
// hosts is the optional audience pin, as a comma-separated list.
func NewOutpostVerifier(issuer, jwksURL, hosts string) *OutpostVerifier {
	v := &OutpostVerifier{
		Issuer:  strings.TrimSuffix(issuer, "/"),
		JWKSURL: jwksURL,
		Client:  &http.Client{Timeout: 5 * time.Second},
	}
	for _, h := range strings.Split(hosts, ",") {
		if h = normalizeHost(strings.TrimSpace(h)); h != "" {
			v.Hosts = append(v.Hosts, h)
		}
	}
	return v
}

// normalizeHost reduces a Host header or a configured name to the form
// Outpost puts in aud: no port, no brackets, lower case, no trailing dot.
func normalizeHost(raw string) string {
	h := raw
	if host, _, err := net.SplitHostPort(raw); err == nil {
		h = host
	}
	h = strings.TrimPrefix(strings.TrimSuffix(h, "]"), "[")
	return strings.TrimSuffix(strings.ToLower(h), ".")
}

func (v *OutpostVerifier) clock() time.Time {
	if v.now != nil {
		return v.now()
	}
	return time.Now()
}

type outpostClaims struct {
	Iss string          `json:"iss"`
	Aud json.RawMessage `json:"aud"`
	Sub string          `json:"sub"`
	Iat int64           `json:"iat"`
	Nbf int64           `json:"nbf"`
	Exp int64           `json:"exp"`
}

// audiences reads aud, which RFC 7519 allows to be a string or an array.
func (c outpostClaims) audiences() []string {
	var one string
	if json.Unmarshal(c.Aud, &one) == nil {
		return []string{one}
	}
	var many []string
	if json.Unmarshal(c.Aud, &many) == nil {
		return many
	}
	return nil
}

// Verify checks the request's identity token and returns its subject.
func (v *OutpostVerifier) Verify(r *http.Request) (string, error) {
	token := r.Header.Get("X-Outpost-Identity")
	if token == "" {
		return "", errNoIdentity
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", errors.New("malformed token")
	}
	enc := base64.RawURLEncoding

	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	raw, err := enc.DecodeString(parts[0])
	if err != nil || json.Unmarshal(raw, &header) != nil {
		return "", errors.New("malformed token header")
	}
	if header.Alg != "EdDSA" {
		return "", fmt.Errorf("unexpected alg %q", header.Alg)
	}
	sig, err := enc.DecodeString(parts[2])
	if err != nil || len(sig) != ed25519.SignatureSize {
		return "", errors.New("malformed token signature")
	}
	key, err := v.key(header.Kid)
	if err != nil {
		return "", err
	}
	if !ed25519.Verify(key, []byte(parts[0]+"."+parts[1]), sig) {
		return "", errors.New("bad signature")
	}

	var claims outpostClaims
	raw, err = enc.DecodeString(parts[1])
	if err != nil || json.Unmarshal(raw, &claims) != nil {
		return "", errors.New("malformed token claims")
	}
	if strings.TrimSuffix(claims.Iss, "/") != v.Issuer {
		return "", fmt.Errorf("unexpected iss %q", claims.Iss)
	}
	now := v.clock()
	if claims.Exp == 0 || !now.Before(time.Unix(claims.Exp, 0).Add(outpostLeeway)) {
		return "", errors.New("token expired")
	}
	if claims.Nbf != 0 && now.Add(outpostLeeway).Before(time.Unix(claims.Nbf, 0)) {
		return "", errors.New("token not yet valid")
	}
	if claims.Iat != 0 && now.Add(outpostLeeway).Before(time.Unix(claims.Iat, 0)) {
		return "", errors.New("token issued in the future")
	}
	if !v.audienceOK(r, claims.audiences()) {
		return "", errors.New("token is for another host")
	}
	if claims.Sub == "" {
		return "", errors.New("token has no subject")
	}
	return claims.Sub, nil
}

func (v *OutpostVerifier) audienceOK(r *http.Request, auds []string) bool {
	host := normalizeHost(r.Host)
	for _, aud := range auds {
		aud = normalizeHost(aud)
		if aud == "" || aud != host {
			continue
		}
		if len(v.Hosts) == 0 {
			return true
		}
		for _, h := range v.Hosts {
			if aud == h {
				return true
			}
		}
	}
	return false
}

// key returns the public key named kid, fetching the JWKS when the cache
// is stale or doesn't know the key.
func (v *OutpostVerifier) key(kid string) (ed25519.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	now := v.clock()
	key, known := v.keys[kid]
	stale := now.Sub(v.fetched) >= outpostKeysTTL
	if known && !stale {
		return key, nil
	}
	if v.keys == nil || now.Sub(v.lastAttempt) >= outpostRefetchGap {
		v.lastAttempt = now
		keys, err := v.fetch()
		if err != nil {
			v.logf("outpost: fetching %s: %v", v.JWKSURL, err)
		} else {
			v.keys, v.fetched = keys, now
		}
	}
	if v.keys == nil {
		return nil, errKeysUnavailable
	}
	// A stale set still verifies while the gateway can't be reached: Outpost
	// keeps a retired key published for a day.
	if key, ok := v.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("unknown key %q", kid)
}

func (v *OutpostVerifier) fetch() (map[string]ed25519.PublicKey, error) {
	resp, err := v.Client.Get(v.JWKSURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %s", resp.Status)
	}
	var set struct {
		Keys []struct {
			Kty string `json:"kty"`
			Crv string `json:"crv"`
			X   string `json:"x"`
			Kid string `json:"kid"`
			Alg string `json:"alg"`
			Use string `json:"use"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, outpostJWKSLimit)).Decode(&set); err != nil {
		return nil, err
	}
	keys := map[string]ed25519.PublicKey{}
	for _, k := range set.Keys {
		if k.Kty != "OKP" || k.Crv != "Ed25519" || k.Kid == "" {
			continue
		}
		if (k.Alg != "" && k.Alg != "EdDSA") || (k.Use != "" && k.Use != "sig") {
			continue
		}
		x, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil || len(x) != ed25519.PublicKeySize {
			continue
		}
		keys[k.Kid] = ed25519.PublicKey(x)
	}
	if len(keys) == 0 {
		return nil, errors.New("no Ed25519 keys in the set")
	}
	return keys, nil
}

// logf logs at most once a minute, so a neighbour hammering the port
// with bad tokens can't flood the log. Callers hold v.mu.
func (v *OutpostVerifier) logf(format string, args ...interface{}) {
	now := v.clock()
	if now.Sub(v.lastLog) < time.Minute {
		return
	}
	v.lastLog = now
	log.Printf(format, args...)
}

func (v *OutpostVerifier) logRejection(r *http.Request, err error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.logf("outpost: refused %s %s: %v", r.Method, r.URL.Path, err)
}

// outpostIdentityGuard refuses every request without a valid identity
// token, except the healthcheck, which Outpost probes on loopback with no
// identity at all.
func (s *Server) outpostIdentityGuard(c *router.Context) {
	if c.Req.URL.Path == s.BasePath+"/up" {
		c.Next()
		return
	}
	if _, err := s.OutpostVerifier.Verify(c.Req); err != nil {
		s.OutpostVerifier.logRejection(c.Req, err)
		if errors.Is(err, errKeysUnavailable) {
			c.Out.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		c.Out.WriteHeader(http.StatusUnauthorized)
		return
	}
	c.Next()
}

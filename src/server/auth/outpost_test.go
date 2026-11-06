package auth

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/server/router"
)

const testIssuer = "https://outpost.example"

type testKey struct {
	id   string
	priv ed25519.PrivateKey
}

func newTestKey(t *testing.T, id string) testKey {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return testKey{id: id, priv: priv}
}

// jwksServer publishes whatever keys holds, in the shape Outpost's gateway
// serves them, and counts fetches.
type jwksServer struct {
	*httptest.Server
	keys    atomic.Value // []testKey
	fetches atomic.Int32
	fail    atomic.Bool
}

func newJWKSServer(t *testing.T, keys ...testKey) *jwksServer {
	t.Helper()
	s := &jwksServer{}
	s.keys.Store(keys)
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.fetches.Add(1)
		if s.fail.Load() {
			http.Error(w, "down", http.StatusInternalServerError)
			return
		}
		type jwk struct {
			Kty string `json:"kty"`
			Crv string `json:"crv"`
			X   string `json:"x"`
			Kid string `json:"kid"`
			Alg string `json:"alg"`
			Use string `json:"use"`
		}
		var set struct {
			Keys []jwk `json:"keys"`
		}
		for _, k := range s.keys.Load().([]testKey) {
			pub := k.priv.Public().(ed25519.PublicKey)
			set.Keys = append(set.Keys, jwk{"OKP", "Ed25519", base64.RawURLEncoding.EncodeToString(pub), k.id, "EdDSA", "sig"})
		}
		_ = json.NewEncoder(w).Encode(set)
	}))
	t.Cleanup(s.Close)
	return s
}

func sign(t *testing.T, k testKey, alg string, claims map[string]interface{}) string {
	t.Helper()
	enc := base64.RawURLEncoding
	header, _ := json.Marshal(map[string]string{"alg": alg, "typ": "JWT", "kid": k.id})
	payload, _ := json.Marshal(claims)
	signing := enc.EncodeToString(header) + "." + enc.EncodeToString(payload)
	return signing + "." + enc.EncodeToString(ed25519.Sign(k.priv, []byte(signing)))
}

func claimsFor(now time.Time, aud string) map[string]interface{} {
	return map[string]interface{}{
		"iss":    testIssuer,
		"aud":    aud,
		"sub":    "alice",
		"name":   "Alice Example",
		"email":  "alice@example.com",
		"groups": []string{"family"},
		"iat":    now.Unix(),
		"exp":    now.Add(60 * time.Second).Unix(),
	}
}

func requestWith(host, token string) *http.Request {
	req := httptest.NewRequest("GET", "http://"+host+"/", nil)
	if token != "" {
		req.Header.Set("X-Outpost-Identity", token)
	}
	return req
}

func TestGatewayVerify(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	key := newTestKey(t, "k1")
	other := newTestKey(t, "k1") // same kid, different key: a forgery
	jwks := newJWKSServer(t, key)
	g := &Gateway{Issuer: testIssuer, JWKSURL: jwks.URL, Now: func() time.Time { return now }}

	valid := claimsFor(now, "yarr.outpost.example")
	with := func(k string, v interface{}) map[string]interface{} {
		c := map[string]interface{}{}
		for kk, vv := range valid {
			c[kk] = vv
		}
		c[k] = v
		return c
	}

	tests := []struct {
		name  string
		host  string
		token string
		ok    bool
	}{
		{"valid", "yarr.outpost.example", sign(t, key, "EdDSA", valid), true},
		{"host with port", "yarr.outpost.example:8443", sign(t, key, "EdDSA", valid), true},
		{"no token", "yarr.outpost.example", "", false},
		{"garbage", "yarr.outpost.example", "not.a.token", false},
		{"wrong alg", "yarr.outpost.example", sign(t, key, "none", valid), false},
		{"forged signature", "yarr.outpost.example", sign(t, other, "EdDSA", valid), false},
		{"another app's token", "yarr.outpost.example", sign(t, key, "EdDSA", with("aud", "other.outpost.example")), false},
		{"wrong issuer", "yarr.outpost.example", sign(t, key, "EdDSA", with("iss", "https://evil.example")), false},
		{"no subject", "yarr.outpost.example", sign(t, key, "EdDSA", with("sub", "")), false},
		{"expired", "yarr.outpost.example", sign(t, key, "EdDSA", with("exp", now.Add(-time.Minute).Unix())), false},
		{"within skew", "yarr.outpost.example", sign(t, key, "EdDSA", with("exp", now.Add(-5*time.Second).Unix())), true},
		{"issued in the future", "yarr.outpost.example", sign(t, key, "EdDSA", with("iat", now.Add(time.Minute).Unix())), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, ok := g.Verify(requestWith(tt.host, tt.token))
			if ok != tt.ok {
				t.Fatalf("Verify ok = %v, want %v", ok, tt.ok)
			}
			if ok && (id.User != "alice" || id.Name != "Alice Example" || id.Email != "alice@example.com" || len(id.Groups) != 1) {
				t.Fatalf("identity = %+v", id)
			}
		})
	}
}

func TestGatewayVerifyIgnoresPlainHeaders(t *testing.T) {
	jwks := newJWKSServer(t, newTestKey(t, "k1"))
	g := &Gateway{Issuer: testIssuer, JWKSURL: jwks.URL}
	req := requestWith("yarr.outpost.example", "")
	req.Header.Set("X-Outpost-User", "alice")
	if _, ok := g.Verify(req); ok {
		t.Fatal("X-Outpost-User without a signed token must not authenticate")
	}
}

func TestGatewayPinnedAudience(t *testing.T) {
	now := time.Now()
	key := newTestKey(t, "k1")
	jwks := newJWKSServer(t, key)
	g := &Gateway{Issuer: testIssuer, JWKSURL: jwks.URL, Audience: "rss.outpost.example"}

	// A token for another app, replayed with a Host to match it.
	replay := sign(t, key, "EdDSA", claimsFor(now, "other.outpost.example"))
	if _, ok := g.Verify(requestWith("other.outpost.example", replay)); ok {
		t.Fatal("a pinned audience must refuse another app's token whatever Host says")
	}
	ours := sign(t, key, "EdDSA", claimsFor(now, "rss.outpost.example"))
	if _, ok := g.Verify(requestWith("127.0.0.1:8090", ours)); !ok {
		t.Fatal("a pinned audience must accept its own token whatever Host says")
	}
}

func TestGatewayKeyRotationAndCaching(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	old, rotated := newTestKey(t, "old"), newTestKey(t, "new")
	jwks := newJWKSServer(t, old)
	g := &Gateway{Issuer: testIssuer, JWKSURL: jwks.URL, Now: func() time.Time { return now }}
	host := "yarr.outpost.example"

	for i := 0; i < 3; i++ {
		if _, ok := g.Verify(requestWith(host, sign(t, old, "EdDSA", claimsFor(now, host)))); !ok {
			t.Fatal("valid token refused")
		}
	}
	if n := jwks.fetches.Load(); n != 1 {
		t.Fatalf("fetched keys %d times, want 1", n)
	}

	// `outpost auth rotate-key`: an unknown kid refetches.
	jwks.keys.Store([]testKey{old, rotated})
	now = now.Add(time.Minute)
	if _, ok := g.Verify(requestWith(host, sign(t, rotated, "EdDSA", claimsFor(now, host)))); !ok {
		t.Fatal("token signed with a rotated-in key refused")
	}

	// Unknown kids cannot force a fetch per request.
	stranger := newTestKey(t, "stranger")
	before := jwks.fetches.Load()
	for i := 0; i < 5; i++ {
		g.Verify(requestWith(host, sign(t, stranger, "EdDSA", claimsFor(now, host))))
	}
	if n := jwks.fetches.Load() - before; n != 0 {
		t.Fatalf("unknown kids caused %d fetches inside the refetch interval", n)
	}

	// The gateway going away does not log anyone out.
	jwks.fail.Store(true)
	now = now.Add(10 * time.Minute)
	if _, ok := g.Verify(requestWith(host, sign(t, rotated, "EdDSA", claimsFor(now, host)))); !ok {
		t.Fatal("a failed refresh must keep the keys already known")
	}
}

func TestMiddlewareGateway(t *testing.T) {
	now := time.Now()
	key := newTestKey(t, "k1")
	jwks := newJWKSServer(t, key)
	m := &Middleware{
		Username: "me",
		Password: "secret",
		Gateway:  &Gateway{Issuer: testIssuer, JWKSURL: jwks.URL},
	}
	reached := false
	r := router.NewRouter("")
	r.Use(m.Handler)
	r.For("/api/feeds", func(c *router.Context) { reached = true })
	serve := func(req *http.Request) (*httptest.ResponseRecorder, bool) {
		reached = false
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec, reached
	}

	req := httptest.NewRequest("GET", "http://yarr.outpost.example/api/feeds", nil)
	req.Header.Set("X-Outpost-Identity", sign(t, key, "EdDSA", claimsFor(now, "yarr.outpost.example")))
	if _, reached := serve(req); !reached {
		t.Fatal("a request signed by the gateway should skip yarr's login")
	}

	req = httptest.NewRequest("GET", "http://yarr.outpost.example/api/feeds", nil)
	req.Header.Set("X-Outpost-User", "alice")
	if rec, reached := serve(req); reached || rec.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned request: reached=%v code=%d, want 401", reached, rec.Code)
	}
}

func TestMiddlewareSecureCookieAuto(t *testing.T) {
	for _, tt := range []struct {
		name   string
		proto  string
		secure bool
	}{
		{"tailnet node, plain http", "http", false},
		{"no proxy", "", false},
		{"gateway over https", "https", true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			m := &Middleware{Username: "me", Password: "secret", SecureCookie: true, SecureCookieAuto: true}
			form := strings.NewReader("username=me&password=secret")
			req := httptest.NewRequest("POST", "http://yarr/", form)
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			if tt.proto != "" {
				req.Header.Set("X-Forwarded-Proto", tt.proto)
			}
			r := router.NewRouter("")
			r.Use(m.Handler)
			r.For("/", func(c *router.Context) {})
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			cookies := rec.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("got %d cookies, want 1", len(cookies))
			}
			if cookies[0].Secure != tt.secure {
				t.Fatalf("Secure = %v, want %v", cookies[0].Secure, tt.secure)
			}
		})
	}
}

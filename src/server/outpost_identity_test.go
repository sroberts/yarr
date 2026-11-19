package server

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

const testIssuer = "https://outpost.tail.ts.net"

type testKey struct {
	kid  string
	priv ed25519.PrivateKey
}

func newTestKey(t *testing.T, kid string) testKey {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return testKey{kid: kid, priv: priv}
}

// fakeJWKS serves whatever keys currently holds, counting fetches.
type fakeJWKS struct {
	srv     *httptest.Server
	keys    atomic.Value // []testKey
	fetches atomic.Int32
	down    atomic.Bool
}

func newFakeJWKS(t *testing.T, keys ...testKey) *fakeJWKS {
	f := &fakeJWKS{}
	f.keys.Store(keys)
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.fetches.Add(1)
		if f.down.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		var set struct {
			Keys []map[string]string `json:"keys"`
		}
		for _, k := range f.keys.Load().([]testKey) {
			pub := k.priv.Public().(ed25519.PublicKey)
			set.Keys = append(set.Keys, map[string]string{
				"kty": "OKP", "crv": "Ed25519", "alg": "EdDSA", "use": "sig",
				"kid": k.kid, "x": base64.RawURLEncoding.EncodeToString(pub),
			})
		}
		json.NewEncoder(w).Encode(set)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

// sign makes a token the way Outpost's gateway does (internal/gateway/jwt.go).
func sign(t *testing.T, k testKey, header, claims map[string]interface{}) string {
	t.Helper()
	h := map[string]interface{}{"alg": "EdDSA", "typ": "JWT", "kid": k.kid}
	for name, val := range header {
		h[name] = val
	}
	hb, _ := json.Marshal(h)
	cb, _ := json.Marshal(claims)
	enc := base64.RawURLEncoding
	signing := enc.EncodeToString(hb) + "." + enc.EncodeToString(cb)
	return signing + "." + enc.EncodeToString(ed25519.Sign(k.priv, []byte(signing)))
}

func claimsFor(aud string, now time.Time) map[string]interface{} {
	return map[string]interface{}{
		"iss":    testIssuer,
		"aud":    aud,
		"sub":    "scott",
		"groups": []string{},
		"iat":    now.Unix(),
		"exp":    now.Add(60 * time.Second).Unix(),
	}
}

func identityRequest(host, token string) *http.Request {
	r := httptest.NewRequest("GET", "/api/status", nil)
	r.Host = host
	if token != "" {
		r.Header.Set("X-Outpost-Identity", token)
	}
	return r
}

func TestOutpostVerifier(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	key := newTestKey(t, "k1")
	other := newTestKey(t, "k1") // same kid, different key
	jwks := newFakeJWKS(t, key)

	tamper := func(tok string) string {
		parts := strings.Split(tok, ".")
		c := claimsFor("yarr.tail.ts.net", now)
		c["sub"] = "mallory"
		cb, _ := json.Marshal(c)
		parts[1] = base64.RawURLEncoding.EncodeToString(cb)
		return strings.Join(parts, ".")
	}
	with := func(edit func(map[string]interface{})) map[string]interface{} {
		c := claimsFor("yarr.tail.ts.net", now)
		edit(c)
		return c
	}
	valid := sign(t, key, nil, claimsFor("yarr.tail.ts.net", now))

	cases := []struct {
		name  string
		hosts string
		host  string
		token string
		ok    bool
	}{
		{"valid", "", "yarr.tail.ts.net", valid, true},
		{"host with port and case", "", "YARR.tail.ts.net:443", valid, true},
		{"aud as an array", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["aud"] = []string{"yarr.tail.ts.net"} })), true},
		{"no token", "", "yarr.tail.ts.net", "", false},
		{"garbage", "", "yarr.tail.ts.net", "not.a.jwt", false},
		{"two parts", "", "yarr.tail.ts.net", "abc.def", false},
		{"signed by another key", "", "yarr.tail.ts.net", sign(t, other, nil, claimsFor("yarr.tail.ts.net", now)), false},
		{"claims tampered", "", "yarr.tail.ts.net", tamper(valid), false},
		{"alg none", "", "yarr.tail.ts.net", sign(t, key, map[string]interface{}{"alg": "none"}, claimsFor("yarr.tail.ts.net", now)), false},
		{"unknown kid", "", "yarr.tail.ts.net", sign(t, key, map[string]interface{}{"kid": "nope"}, claimsFor("yarr.tail.ts.net", now)), false},
		{"wrong issuer", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["iss"] = "https://evil.example" })), false},
		{"expired", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["exp"] = now.Add(-10 * time.Second).Unix() })), false},
		{"within skew of expiry", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["exp"] = now.Add(-2 * time.Second).Unix() })), true},
		{"no exp", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { delete(c, "exp") })), false},
		{"issued in the future", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["iat"] = now.Add(time.Minute).Unix() })), false},
		{"no subject", "", "yarr.tail.ts.net", sign(t, key, nil, with(func(c map[string]interface{}) { c["sub"] = "" })), false},
		{"token for a sibling app", "", "yarr.tail.ts.net", sign(t, key, nil, claimsFor("plumbline.tail.ts.net", now)), false},
		// Without a pin, a sibling that forges Host gets in; that is what
		// YARR_OUTPOST_HOSTS is for.
		{"sibling token, forged host, no pin", "", "plumbline.tail.ts.net", sign(t, key, nil, claimsFor("plumbline.tail.ts.net", now)), true},
		{"sibling token, forged host, pinned", "yarr.tail.ts.net, yarr-1.tail.ts.net", "plumbline.tail.ts.net", sign(t, key, nil, claimsFor("plumbline.tail.ts.net", now)), false},
		{"pinned, renamed node", "yarr.tail.ts.net, yarr-1.tail.ts.net", "yarr-1.tail.ts.net", sign(t, key, nil, claimsFor("yarr-1.tail.ts.net", now)), true},
	}
	for _, tc := range cases {
		v := NewOutpostVerifier(testIssuer+"/", jwks.srv.URL, tc.hosts)
		v.now = func() time.Time { return now }
		sub, err := v.Verify(identityRequest(tc.host, tc.token))
		if tc.ok && (err != nil || sub != "scott") {
			t.Errorf("%s: got (%q, %v), want scott", tc.name, sub, err)
		}
		if !tc.ok && err == nil {
			t.Errorf("%s: accepted, want refused", tc.name)
		}
	}
}

func TestOutpostVerifierKeyCache(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	k1, k2 := newTestKey(t, "k1"), newTestKey(t, "k2")
	jwks := newFakeJWKS(t, k1)
	v := NewOutpostVerifier(testIssuer, jwks.srv.URL, "")
	v.now = func() time.Time { return now }
	verify := func(k testKey) error {
		_, err := v.Verify(identityRequest("yarr.tail.ts.net", sign(t, k, nil, claimsFor("yarr.tail.ts.net", now))))
		return err
	}

	for i := 0; i < 3; i++ {
		if err := verify(k1); err != nil {
			t.Fatal(err)
		}
	}
	if n := jwks.fetches.Load(); n != 1 {
		t.Errorf("fetches after 3 requests: %d, want 1", n)
	}

	// A rotated key isn't known yet: the first token naming it refetches.
	jwks.keys.Store([]testKey{k1, k2})
	if err := verify(k2); err == nil {
		t.Error("k2 accepted inside the refetch gap")
	}
	now = now.Add(outpostRefetchGap)
	if err := verify(k2); err != nil {
		t.Errorf("k2 after rotation: %v", err)
	}
	if n := jwks.fetches.Load(); n != 2 {
		t.Errorf("fetches after rotation: %d, want 2", n)
	}

	// Unknown kids can't make yarr hammer the gateway.
	for i := 0; i < 5; i++ {
		verify(newTestKey(t, "forged"))
	}
	if n := jwks.fetches.Load(); n != 2 {
		t.Errorf("fetches after forged kids: %d, want 2", n)
	}

	// The gateway going away doesn't lock the user out: cached keys hold.
	jwks.down.Store(true)
	now = now.Add(outpostKeysTTL)
	if err := verify(k1); err != nil {
		t.Errorf("stale key while JWKS down: %v", err)
	}
}

func TestOutpostIdentityGuard(t *testing.T) {
	now := time.Now()
	key := newTestKey(t, "k1")
	jwks := newFakeJWKS(t, key)

	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	s := NewServer(db, "127.0.0.1:8000")
	s.OutpostGateway = true
	s.OutpostVerifier = NewOutpostVerifier(testIssuer, jwks.srv.URL, "")

	do := func(method, path, token string) int {
		r := httptest.NewRequest(method, path, strings.NewReader("api_key=x"))
		r.Host = "yarr.tail.ts.net"
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		if token != "" {
			r.Header.Set("X-Outpost-Identity", token)
		}
		rec := httptest.NewRecorder()
		s.handler().ServeHTTP(rec, r)
		return rec.Code
	}
	token := sign(t, key, nil, claimsFor("yarr.tail.ts.net", now))

	for _, p := range []struct{ method, path string }{
		{"GET", "/"}, {"GET", "/api/status"}, {"PUT", "/api/settings"},
		{"POST", "/fever/?api"}, {"POST", "/mcp"}, {"GET", "/static/javascripts/app.js"},
	} {
		if code := do(p.method, p.path, ""); code != http.StatusUnauthorized {
			t.Errorf("%s %s with no token: got %d, want 401", p.method, p.path, code)
		}
	}
	if code := do("GET", "/api/status", token); code != http.StatusOK {
		t.Errorf("GET /api/status with a token: got %d, want 200", code)
	}
	if code := do("GET", "/up", ""); code != http.StatusOK {
		t.Errorf("healthcheck with no token: got %d, want 200", code)
	}

	// No keys at all is the gateway's fault, not the caller's.
	jwks.down.Store(true)
	s.OutpostVerifier = NewOutpostVerifier(testIssuer, jwks.srv.URL, "")
	if code := do("GET", "/api/status", token); code != http.StatusServiceUnavailable {
		t.Errorf("JWKS unreachable: got %d, want 503", code)
	}
}

// Cached keys outlive a JWKS outage only as long as Outpost keeps a retired
// key published (#264): past that, the guard says 503, and the first good
// fetch after the outage restores access.
func TestOutpostVerifierKeysMaxAge(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	k1 := newTestKey(t, "k1")
	jwks := newFakeJWKS(t, k1)
	v := NewOutpostVerifier(testIssuer, jwks.srv.URL, "")
	v.now = func() time.Time { return now }
	verify := func() error {
		_, err := v.Verify(identityRequest("yarr.tail.ts.net", sign(t, k1, nil, claimsFor("yarr.tail.ts.net", now))))
		return err
	}

	if err := verify(); err != nil {
		t.Fatal(err)
	}
	jwks.down.Store(true)
	now = now.Add(outpostKeysMaxAge - time.Second)
	if err := verify(); err != nil {
		t.Errorf("cached key just inside the max age: %v", err)
	}
	now = now.Add(time.Second)
	if err := verify(); !errors.Is(err, errKeysUnavailable) {
		t.Errorf("cached key at the max age: %v, want errKeysUnavailable", err)
	}

	// the guard turns it into a 503, not a 401
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	s := NewServer(db, "127.0.0.1:8000")
	s.OutpostGateway = true
	s.OutpostVerifier = v
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, identityRequest("yarr.tail.ts.net", sign(t, k1, nil, claimsFor("yarr.tail.ts.net", now))))
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("guard status past the max age: %d, want 503", rec.Code)
	}

	jwks.down.Store(false)
	now = now.Add(outpostRefetchGap)
	if err := verify(); err != nil {
		t.Errorf("after the JWKS comes back: %v", err)
	}
}

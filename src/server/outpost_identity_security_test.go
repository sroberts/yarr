package server

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

// A JWKS fetch that hangs must not stall requests whose key yarr already
// holds: a neighbour sending one forged kid per refetch gap would otherwise
// freeze every request for the length of the fetch.
func TestOutpostVerifierFetchDoesNotBlockKnownKeys(t *testing.T) {
	k1 := newTestKey(t, "k1")
	var fetches atomic.Int32
	var hang atomic.Bool
	release := make(chan struct{})
	arrived := make(chan struct{}, 16)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fetches.Add(1)
		if hang.Load() {
			arrived <- struct{}{}
			<-release
		}
		pub := k1.priv.Public().(ed25519.PublicKey)
		json.NewEncoder(w).Encode(map[string]interface{}{"keys": []map[string]string{{
			"kty": "OKP", "crv": "Ed25519", "kid": k1.kid,
			"x": base64.RawURLEncoding.EncodeToString(pub),
		}}})
	}))
	defer srv.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()

	start := time.Unix(1_800_000_000, 0)
	v := NewOutpostVerifier(testIssuer, srv.URL, "")
	v.now = func() time.Time { return start }
	host := "yarr.tail.ts.net"
	good := sign(t, k1, nil, claimsFor(host, start))
	if _, err := v.Verify(identityRequest(host, good)); err != nil {
		t.Fatal(err)
	}

	// Past the refetch gap, still inside the TTL: a forged kid refetches.
	later := start.Add(outpostRefetchGap)
	v.now = func() time.Time { return later }
	hang.Store(true)
	forged := sign(t, newTestKey(t, "forged"), nil, claimsFor(host, later))

	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v.Verify(identityRequest(host, forged))
		}()
	}
	select {
	case <-arrived:
	case <-time.After(5 * time.Second):
		t.Fatal("forged kid did not trigger a refetch")
	}

	done := make(chan error, 1)
	go func() {
		_, err := v.Verify(identityRequest(host, sign(t, k1, nil, claimsFor(host, later))))
		done <- err
	}()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("known key during a hung fetch: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Error("a request with a cached key waited on the hung JWKS fetch")
	}

	close(release)
	wg.Wait()
	if n := fetches.Load(); n != 2 {
		t.Errorf("fetches: %d, want 2 (concurrent forged kids share one fetch)", n)
	}
}

// Under a base path only <base>/up skips the identity check.
func TestOutpostIdentityGuardBasePath(t *testing.T) {
	now := time.Now()
	key := newTestKey(t, "k1")
	jwks := newFakeJWKS(t, key)
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	s := NewServer(db, "127.0.0.1:8000")
	s.BasePath = "/yarr"
	s.OutpostGateway = true
	s.OutpostVerifier = NewOutpostVerifier(testIssuer, jwks.srv.URL, "")
	h := s.handler()
	do := func(path, token string) int {
		r := httptest.NewRequest("GET", path, nil)
		r.Host = "yarr.tail.ts.net"
		if token != "" {
			r.Header.Set("X-Outpost-Identity", token)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec.Code
	}
	if code := do("/yarr/up", ""); code != http.StatusOK {
		t.Errorf("/yarr/up with no token: %d, want 200", code)
	}
	for _, p := range []string{"/yarr/", "/yarr/api/status", "/yarr/static/javascripts/app.js", "/yarr/up/../api/status"} {
		if code := do(p, ""); code != http.StatusUnauthorized && code != http.StatusNotFound {
			t.Errorf("%s with no token: %d, want 401", p, code)
		}
	}
	if code := do("/yarr/api/status", sign(t, key, nil, claimsFor("yarr.tail.ts.net", now))); code != http.StatusOK {
		t.Errorf("/yarr/api/status with a token: %d, want 200", code)
	}
}

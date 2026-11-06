package server

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

func TestSameOriginRequest(t *testing.T) {
	cases := []struct {
		name            string
		origin, referer string
		fwdHost         string
		want            bool
	}{
		{"no origin or referer (API client)", "", "", "", true},
		{"same host", "https://yarr.tail.ts.net", "", "", true},
		{"same host, different case", "https://YARR.tail.ts.net", "", "", true},
		{"sibling app on the same site", "https://plumbline.tail.ts.net", "", "", false},
		{"forwarded host matches", "https://yarr-1.tail.ts.net", "", "yarr-1.tail.ts.net", true},
		{"null origin", "null", "", "", false},
		{"referer same host", "", "https://yarr.tail.ts.net/settings", "", true},
		{"referer sibling", "", "https://evil.tail.ts.net/x", "", false},
		{"origin wins over referer", "https://evil.tail.ts.net", "https://yarr.tail.ts.net/", "", false},
	}
	for _, tc := range cases {
		r := httptest.NewRequest("POST", "https://yarr.tail.ts.net/api/settings", nil)
		r.Host = "yarr.tail.ts.net"
		if tc.origin != "" {
			r.Header.Set("Origin", tc.origin)
		}
		if tc.referer != "" {
			r.Header.Set("Referer", tc.referer)
		}
		if tc.fwdHost != "" {
			r.Header.Set("X-Forwarded-Host", tc.fwdHost)
		}
		if got := sameOriginRequest(r); got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}

func gatewayRequest(t *testing.T, s *Server, method, origin string) int {
	t.Helper()
	r := httptest.NewRequest(method, "/api/settings", strings.NewReader(`{"theme_name":"dark"}`))
	r.Host = "yarr.tail.ts.net"
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, r)
	return rec.Code
}

func TestGatewayGuardsStateChangingRequests(t *testing.T) {
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	s := NewServer(db, "127.0.0.1:8000")
	s.OutpostGateway = true

	if code := gatewayRequest(t, s, "PUT", "https://plumbline.tail.ts.net"); code != http.StatusForbidden {
		t.Errorf("cross-origin PUT: got %d, want 403", code)
	}
	if code := gatewayRequest(t, s, "PUT", "https://yarr.tail.ts.net"); code != http.StatusOK {
		t.Errorf("same-origin PUT: got %d, want 200", code)
	}
	if code := gatewayRequest(t, s, "PUT", ""); code != http.StatusOK {
		t.Errorf("PUT with no Origin (API client): got %d, want 200", code)
	}
	if code := gatewayRequest(t, s, "GET", "https://plumbline.tail.ts.net"); code != http.StatusOK {
		t.Errorf("cross-origin GET: got %d, want 200 (reads are not guarded)", code)
	}

	// Without the gateway nothing changes: the guard is not installed.
	s.OutpostGateway = false
	if code := gatewayRequest(t, s, "PUT", "https://plumbline.tail.ts.net"); code != http.StatusOK {
		t.Errorf("no gateway, cross-origin PUT: got %d, want 200 (unchanged behaviour)", code)
	}
}

func TestGatewayIndexOffersOutpostSignOut(t *testing.T) {
	db, _ := storage.New(":memory:")
	s := NewServer(db, "127.0.0.1:8000")
	s.OutpostGateway = true
	rec := httptest.NewRecorder()
	s.handler().ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	// html/template pads JS values with spaces: "window.app.gateway =  true "
	if !regexp.MustCompile(`window\.app\.gateway\s*=\s*true\b`).MatchString(rec.Body.String()) {
		t.Error("index does not tell the page it is behind the gateway")
	}
}

package server

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

func mcpTestHandler(t *testing.T) http.Handler {
	t.Helper()
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	log.SetOutput(os.Stderr)
	if err != nil {
		t.Fatal(err)
	}
	return NewServer(db, "127.0.0.1:8000").handler()
}

const mcpPing = `{"jsonrpc":"2.0","id":1,"method":"ping"}`

// mcpAuth lets everything through when no credentials are configured, which is
// the default and the usual tailnet posture. A page on any other localhost port
// is same-site as far as cookies go and same-origin-enough for the Origin guard,
// so a text/plain body -- a CORS simple request, no preflight -- would otherwise
// reach destructive tools like delete_folder.
func TestMCPRejectsCrossSiteSimpleRequest(t *testing.T) {
	handler := mcpTestHandler(t)

	body := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mark_all_read","arguments":{}}}`
	request := httptest.NewRequest("POST", "/mcp", strings.NewReader(body))
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Content-Type", "text/plain")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415 for a cross-site simple request, got %d", recorder.Code)
	}
}

func TestMCPContentTypeOnlyRequiredOfBrowsers(t *testing.T) {
	handler := mcpTestHandler(t)

	for _, tc := range [...]struct {
		name        string
		origin      string
		contentType string
		status      int
	}{
		// A browser is held to a JSON content type.
		{name: "browser json", origin: "http://localhost:8000", contentType: "application/json", status: http.StatusOK},
		{name: "browser json with charset", origin: "http://localhost:8000", contentType: "application/json; charset=utf-8", status: http.StatusOK},
		{name: "browser text", origin: "http://localhost:8000", contentType: "text/plain", status: http.StatusUnsupportedMediaType},
		{name: "browser form", origin: "http://localhost:8000", contentType: "application/x-www-form-urlencoded", status: http.StatusUnsupportedMediaType},
		{name: "browser none", origin: "http://localhost:8000", contentType: "", status: http.StatusUnsupportedMediaType},
		// A client that sends no Origin has no ambient authority to ride.
		{name: "client none", origin: "", contentType: "", status: http.StatusOK},
		{name: "client json", origin: "", contentType: "application/json", status: http.StatusOK},
		{name: "client text", origin: "", contentType: "text/plain", status: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest("POST", "/mcp", strings.NewReader(mcpPing))
			if tc.origin != "" {
				request.Header.Set("Origin", tc.origin)
			}
			if tc.contentType != "" {
				request.Header.Set("Content-Type", tc.contentType)
			}
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != tc.status {
				t.Errorf("origin %q type %q: got %d, want %d", tc.origin, tc.contentType, recorder.Code, tc.status)
			}
		})
	}
}

func TestMCPOriginGuard(t *testing.T) {
	handler := mcpTestHandler(t)

	for _, tc := range [...]struct {
		origin string
		status int
	}{
		{origin: "", status: http.StatusOK},
		{origin: "http://example.com", status: http.StatusOK}, // matches the request Host
		{origin: "http://localhost:9999", status: http.StatusOK},
		{origin: "http://127.0.0.1:9999", status: http.StatusOK},
		{origin: "https://evil.example", status: http.StatusForbidden},
		{origin: "http://yarr.evil.example", status: http.StatusForbidden},
		{origin: "null", status: http.StatusForbidden},
	} {
		name := tc.origin
		if name == "" {
			name = "absent"
		}
		t.Run(name, func(t *testing.T) {
			request := httptest.NewRequest("POST", "/mcp", strings.NewReader(mcpPing))
			request.Host = "example.com"
			request.Header.Set("Content-Type", "application/json")
			if tc.origin != "" {
				request.Header.Set("Origin", tc.origin)
			}
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, request)

			if recorder.Code != tc.status {
				t.Errorf("origin %q: got %d, want %d", tc.origin, recorder.Code, tc.status)
			}
		})
	}
}

func TestMCPRejectsNonPOST(t *testing.T) {
	handler := mcpTestHandler(t)

	for _, method := range [...]string{"GET", "DELETE", "PUT"} {
		t.Run(method, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(method, "/mcp", nil))

			if recorder.Code != http.StatusMethodNotAllowed {
				t.Errorf("got %d, want 405", recorder.Code)
			}
			if allow := recorder.Header().Get("Allow"); allow != "POST" {
				t.Errorf("Allow header = %q, want POST", allow)
			}
		})
	}
}

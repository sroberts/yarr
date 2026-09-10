package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

const initializeBody = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`

func testServer(t *testing.T) *Server {
	t.Helper()
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	log.SetOutput(os.Stderr)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	srv := NewServer(db, "127.0.0.1:8000")
	srv.Version = "2.6"
	return srv
}

func TestMCPEndpoint(t *testing.T) {
	srv := testServer(t)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/mcp", strings.NewReader(initializeBody))
	request.Header.Set("Content-Type", "application/json")
	srv.handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var resp struct {
		Result struct {
			ServerInfo struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"serverInfo"`
		} `json:"result"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response is not JSON-RPC: %v (body %q)", err, recorder.Body.String())
	}
	if resp.Result.ServerInfo.Name != "yarr" || resp.Result.ServerInfo.Version != "2.6" {
		t.Fatalf("serverInfo = %+v", resp.Result.ServerInfo)
	}
}

// The MCP endpoint reads and changes everything in the reader, so it is not
// public: with authentication configured it answers an unauthenticated caller
// the same way the rest of the app does.
func TestMCPEndpointRequiresAuth(t *testing.T) {
	srv := testServer(t)
	srv.Username = "user"
	srv.Password = "secret"

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/mcp", strings.NewReader(initializeBody))
	request.Header.Set("Content-Type", "application/json")
	srv.handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without credentials, got %d", recorder.Code)
	}
}

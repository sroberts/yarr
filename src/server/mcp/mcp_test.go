package mcp

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/storage"
)

type rpcResponse struct {
	JSONRPC string                     `json:"jsonrpc"`
	ID      json.RawMessage            `json:"id"`
	Result  map[string]json.RawMessage `json:"result"`
	Error   *rpcError                  `json:"error"`
}

// newTestHandler wires the handler into a bare router, so that these tests
// exercise the protocol without dragging in package server.
func newTestHandler(db *storage.Storage) http.Handler {
	r := router.NewRouter("")
	h := &Handler{DB: db, Version: "2.6"}
	r.For("/mcp", h.Handle)
	return r
}

// request sends one request. It never asks for gzip: the gzip middleware would
// wrap even an empty 202 body, which these tests inspect byte for byte.
func send(h http.Handler, method, body string) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/mcp", reader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func post(t *testing.T, h http.Handler, body string) (*httptest.ResponseRecorder, rpcResponse) {
	t.Helper()
	rec := send(h, "POST", body)
	var out rpcResponse
	if raw := rec.Body.Bytes(); len(raw) > 0 {
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatalf("response is not JSON-RPC: %v (body %q)", err, raw)
		}
	}
	return rec, out
}

func mustString(t *testing.T, raw json.RawMessage) string {
	t.Helper()
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		t.Fatalf("expected a JSON string, got %q", raw)
	}
	return s
}

func TestInitialize(t *testing.T) {
	h := newTestHandler(nil)
	rec, resp := post(t, h, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
	if got := mustString(t, resp.Result["protocolVersion"]); got != "2025-06-18" {
		t.Fatalf("protocolVersion = %q", got)
	}
	if got := string(resp.Result["instructions"]); !strings.Contains(got, "list_feeds") {
		t.Fatalf("instructions do not mention the tools: %s", got)
	}

	var info struct{ Name, Title, Version string }
	if err := json.Unmarshal(resp.Result["serverInfo"], &info); err != nil {
		t.Fatal(err)
	}
	if info.Name != "yarr" || info.Title != "yarr" || info.Version != "2.6" {
		t.Fatalf("serverInfo = %+v", info)
	}

	// Only tools are advertised. Declaring a capability yarr does not serve
	// would have clients calling methods that answer -32601.
	var caps map[string]json.RawMessage
	if err := json.Unmarshal(resp.Result["capabilities"], &caps); err != nil {
		t.Fatal(err)
	}
	if _, ok := caps["tools"]; !ok {
		t.Fatal("expected a tools capability")
	}
	for _, unsupported := range []string{"resources", "prompts", "logging", "completions"} {
		if _, ok := caps[unsupported]; ok {
			t.Fatalf("capability %q must not be declared", unsupported)
		}
	}
}

func TestInitializeVersionNegotiation(t *testing.T) {
	h := newTestHandler(nil)
	tests := []struct {
		name   string
		params string
		want   string
	}{
		{"latest", `,"params":{"protocolVersion":"2025-06-18"}`, "2025-06-18"},
		{"previous", `,"params":{"protocolVersion":"2025-03-26"}`, "2025-03-26"},
		{"oldest supported", `,"params":{"protocolVersion":"2024-11-05"}`, "2024-11-05"},
		{"unknown", `,"params":{"protocolVersion":"1.0.0"}`, "2025-06-18"},
		{"malformed params", `,"params":"nope"`, "2025-06-18"},
		{"absent params", ``, "2025-06-18"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, resp := post(t, h, `{"jsonrpc":"2.0","id":1,"method":"initialize"`+tt.params+`}`)
			// An unusable version is never an error: the client decides.
			if resp.Error != nil {
				t.Fatalf("unexpected error: %+v", resp.Error)
			}
			if got := mustString(t, resp.Result["protocolVersion"]); got != tt.want {
				t.Fatalf("protocolVersion = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestVersionDefaultsToDev(t *testing.T) {
	r := router.NewRouter("")
	r.For("/mcp", (&Handler{}).Handle)

	_, resp := post(t, r, `{"jsonrpc":"2.0","id":1,"method":"initialize"}`)
	var info struct{ Version string }
	if err := json.Unmarshal(resp.Result["serverInfo"], &info); err != nil {
		t.Fatal(err)
	}
	if info.Version != "dev" {
		t.Fatalf("version = %q, want dev", info.Version)
	}
}

func TestNotifications(t *testing.T) {
	h := newTestHandler(nil)
	tests := []struct {
		name string
		body string
	}{
		{"initialized", `{"jsonrpc":"2.0","method":"notifications/initialized"}`},
		{"unknown notification", `{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":7}}`},
		{"unknown method without id", `{"jsonrpc":"2.0","method":"resources/list"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := send(h, "POST", tt.body)
			if rec.Code != http.StatusAccepted {
				t.Fatalf("expected 202, got %d", rec.Code)
			}
			if body := rec.Body.Bytes(); len(body) != 0 {
				t.Fatalf("expected an empty body, got %q", body)
			}
		})
	}
}

func TestUnknownMethod(t *testing.T) {
	h := newTestHandler(nil)
	rec, resp := post(t, h, `{"jsonrpc":"2.0","id":3,"method":"resources/list"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if resp.Error == nil || resp.Error.Code != codeMethodNotFound {
		t.Fatalf("expected -32601, got %+v", resp.Error)
	}
}

func TestPingReturnsEmptyObject(t *testing.T) {
	h := newTestHandler(nil)
	rec := send(h, "POST", `{"jsonrpc":"2.0","id":"ping-1","method":"ping"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Decoded as raw members so that an absent result is distinguishable from
	// a null one: the spec wants neither, it wants {}.
	var out map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	result, ok := out["result"]
	if !ok {
		t.Fatal("result member is missing")
	}
	if string(result) != "{}" {
		t.Fatalf("result = %s, want {}", result)
	}
}

func TestMalformedRequests(t *testing.T) {
	h := newTestHandler(nil)
	// An id is echoed back whenever one could be read; everything else
	// answers with a null id, as JSON-RPC requires.
	tests := []struct {
		name   string
		body   string
		status int
		code   int
		id     string
	}{
		{"not json", `{"jsonrpc":`, http.StatusBadRequest, codeParseError, "null"},
		{"empty body", ``, http.StatusBadRequest, codeParseError, "null"},
		{"batch", `[{"jsonrpc":"2.0","id":1,"method":"ping"}]`, http.StatusBadRequest, codeInvalidRequest, "null"},
		{"null id", `{"jsonrpc":"2.0","id":null,"method":"ping"}`, http.StatusBadRequest, codeInvalidRequest, "null"},
		{"wrong jsonrpc version", `{"jsonrpc":"1.0","id":1,"method":"ping"}`, http.StatusBadRequest, codeInvalidRequest, "1"},
		{"empty method", `{"jsonrpc":"2.0","id":1,"method":""}`, http.StatusBadRequest, codeInvalidRequest, "1"},
		{"not an object", `"ping"`, http.StatusBadRequest, codeInvalidRequest, "null"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, resp := post(t, h, tt.body)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}
			if resp.Error == nil || resp.Error.Code != tt.code {
				t.Fatalf("error = %+v, want code %d", resp.Error, tt.code)
			}
			if string(resp.ID) != tt.id {
				t.Fatalf("id = %s, want %s", resp.ID, tt.id)
			}
		})
	}
}

func TestBatchMessage(t *testing.T) {
	h := newTestHandler(nil)
	_, resp := post(t, h, `[{"jsonrpc":"2.0","id":1,"method":"ping"}]`)
	if resp.Error == nil || !strings.Contains(resp.Error.Message, "batching") {
		t.Fatalf("expected a message about batching, got %+v", resp.Error)
	}
}

func TestOversizedBody(t *testing.T) {
	h := newTestHandler(nil)
	body := `{"jsonrpc":"2.0","id":1,"method":"ping","params":{"pad":"` + strings.Repeat("x", maxRequestBytes) + `"}}`
	rec := send(h, "POST", body)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413, got %d", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected an empty body, got %q", rec.Body.String())
	}
}

func TestMethodNotAllowed(t *testing.T) {
	h := newTestHandler(nil)
	for _, method := range []string{"GET", "DELETE", "PUT"} {
		rec := send(h, method, "")
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s: expected 405, got %d", method, rec.Code)
		}
		if allow := rec.Header().Get("Allow"); allow != "POST" {
			t.Fatalf("%s: Allow = %q, want POST", method, allow)
		}
	}
}

func TestOriginGuard(t *testing.T) {
	h := newTestHandler(nil)
	tests := []struct {
		origin string
		status int
	}{
		{"", http.StatusOK},
		{"http://localhost:7070", http.StatusOK},
		{"http://127.0.0.1:7070", http.StatusOK},
		{"http://example.com", http.StatusOK}, // matches the request Host below
		{"http://evil.example", http.StatusForbidden},
	}
	for _, tt := range tests {
		req := httptest.NewRequest("POST", "/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"ping"}`))
		req.Host = "example.com"
		if tt.origin != "" {
			req.Header.Set("Origin", tt.origin)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != tt.status {
			t.Fatalf("origin %q: status = %d, want %d", tt.origin, rec.Code, tt.status)
		}
	}
}

func TestIDRoundTrip(t *testing.T) {
	h := newTestHandler(nil)
	for _, id := range []string{`"abc"`, `42`} {
		_, resp := post(t, h, `{"jsonrpc":"2.0","id":`+id+`,"method":"ping"}`)
		if string(resp.ID) != id {
			t.Fatalf("id = %s, want %s", resp.ID, id)
		}
	}
}

func TestToolsList(t *testing.T) {
	h := newTestHandler(nil)
	_, resp := post(t, h, `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"cursor":"ignored"}}`)
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
	if _, ok := resp.Result["nextCursor"]; ok {
		t.Fatal("nextCursor must not be returned: the tool list is never paginated")
	}

	var listed []map[string]json.RawMessage
	if err := json.Unmarshal(resp.Result["tools"], &listed); err != nil {
		t.Fatal(err)
	}
	want := []string{"list_feeds", "list_items", "get_item", "mark_item", "mark_all_read"}
	if len(listed) != len(want) {
		t.Fatalf("got %d tools, want %d", len(listed), len(want))
	}
	for i, name := range want {
		got := mustString(t, listed[i]["name"])
		if got != name {
			t.Fatalf("tool %d = %q, want %q", i, got, name)
		}
		if mustString(t, listed[i]["description"]) == "" {
			t.Fatalf("tool %q has no description", name)
		}
		if mustString(t, listed[i]["title"]) == "" {
			t.Fatalf("tool %q has no title", name)
		}
		if _, ok := listed[i]["annotations"]; !ok {
			t.Fatalf("tool %q has no annotations", name)
		}
		// structuredContent is returned without a declared schema; a client
		// that sees outputSchema is entitled to validate against it.
		if _, ok := listed[i]["outputSchema"]; ok {
			t.Fatalf("tool %q must not declare an outputSchema", name)
		}

		var schema struct {
			Type                 string                 `json:"type"`
			Properties           map[string]interface{} `json:"properties"`
			AdditionalProperties *bool                  `json:"additionalProperties"`
		}
		if err := json.Unmarshal(listed[i]["inputSchema"], &schema); err != nil {
			t.Fatal(err)
		}
		if schema.Type != "object" {
			t.Fatalf("tool %q inputSchema.type = %q", name, schema.Type)
		}
		if schema.AdditionalProperties == nil || *schema.AdditionalProperties {
			t.Fatalf("tool %q must set additionalProperties:false", name)
		}
	}
}

func TestToolsCallBadName(t *testing.T) {
	h := newTestHandler(nil)
	tests := []struct {
		name string
		body string
	}{
		{"missing name", `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"arguments":{}}}`},
		{"no params", `{"jsonrpc":"2.0","id":1,"method":"tools/call"}`},
		{"unknown tool", `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"refresh_feeds"}}`},
		{"params not an object", `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":[]}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, resp := post(t, h, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", rec.Code)
			}
			if resp.Error == nil || resp.Error.Code != codeInvalidParams {
				t.Fatalf("expected -32602, got %+v", resp.Error)
			}
		})
	}
}

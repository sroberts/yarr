package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

// mcpTestServer builds a server backed by an in-memory DB seeded with one feed
// and three unread items. It returns the server, the feed, and the seeded items
// (with ids populated).
func mcpTestServer(t *testing.T) (*Server, *storage.Feed, []storage.Item) {
	t.Helper()
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("storage.New: %v", err)
	}
	feed := db.CreateFeed("Tech News", "", "https://example.com", "https://example.com/feed", nil)
	db.CreateItems([]storage.Item{
		{GUID: "g1", FeedId: feed.Id, Title: "First post", Link: "https://example.com/1", Content: "<p>Hello <b>world</b></p>", Date: time.Now()},
		{GUID: "g2", FeedId: feed.Id, Title: "Second post", Link: "https://example.com/2", Content: "<p>More</p>", Date: time.Now()},
		{GUID: "g3", FeedId: feed.Id, Title: "Third post", Link: "https://example.com/3", Content: "<p>Even more</p>", Date: time.Now()},
	})
	log.SetOutput(os.Stderr)
	items := db.ListItems(storage.ItemFilter{FeedID: &feed.Id}, 10, false, false)
	return NewServer(db, "127.0.0.1:8000"), feed, items
}

// rpcCall posts a JSON-RPC request and returns the recorder. token may be empty.
func rpcCall(t *testing.T, srv *Server, token, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/mcp", strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	srv.handler().ServeHTTP(rec, req)
	return rec
}

// decode parses a JSON-RPC response body.
func decode(t *testing.T, rec *httptest.ResponseRecorder) rpcResponse {
	t.Helper()
	var resp rpcResponse
	if err := json.NewDecoder(rec.Result().Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

// resultMap unmarshals resp.Result into a generic map.
func resultMap(t *testing.T, resp rpcResponse) map[string]interface{} {
	t.Helper()
	raw, _ := json.Marshal(resp.Result)
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("result is not an object: %v", err)
	}
	return m
}

// callTextResult drives a tools/call and returns the text content + isError flag.
func callTextResult(t *testing.T, srv *Server, name, args string) (string, bool) {
	t.Helper()
	body := fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":%q,"arguments":%s}}`, name, args)
	resp := decode(t, rpcCall(t, srv, "", body))
	if resp.Error != nil {
		t.Fatalf("tools/call %s returned rpc error: %+v", name, resp.Error)
	}
	m := resultMap(t, resp)
	isErr, _ := m["isError"].(bool)
	content, _ := m["content"].([]interface{})
	if len(content) == 0 {
		t.Fatalf("tools/call %s returned no content", name)
	}
	first, _ := content[0].(map[string]interface{})
	text, _ := first["text"].(string)
	return text, isErr
}

func TestMCPInitialize(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	srv.Version = "9.9"
	rec := rpcCall(t, srv, "", `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`)
	if rec.Result().StatusCode != 200 {
		t.Fatalf("status = %d", rec.Result().StatusCode)
	}
	resp := decode(t, rec)
	if string(resp.ID) != "1" {
		t.Fatalf("id not echoed: %s", resp.ID)
	}
	m := resultMap(t, resp)
	if m["protocolVersion"] != "2025-06-18" {
		t.Fatalf("protocolVersion = %v", m["protocolVersion"])
	}
	si, _ := m["serverInfo"].(map[string]interface{})
	if si["name"] != "yarr" || si["version"] != "9.9" {
		t.Fatalf("serverInfo = %v", si)
	}
	if _, ok := m["capabilities"].(map[string]interface{})["tools"]; !ok {
		t.Fatalf("missing tools capability")
	}
}

func TestMCPInitializeUnknownVersionFallsBack(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	resp := decode(t, rpcCall(t, srv, "", `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}`))
	if resultMap(t, resp)["protocolVersion"] != mcpProtocolVersion {
		t.Fatalf("expected fallback to %s", mcpProtocolVersion)
	}
}

func TestMCPNotificationNoBody(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	rec := rpcCall(t, srv, "", `{"jsonrpc":"2.0","method":"notifications/initialized"}`)
	if rec.Result().StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", rec.Result().StatusCode)
	}
	body, _ := io.ReadAll(rec.Result().Body)
	if len(body) != 0 {
		t.Fatalf("expected empty body, got %q", body)
	}
}

func TestMCPPing(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	resp := decode(t, rpcCall(t, srv, "", `{"jsonrpc":"2.0","id":1,"method":"ping"}`))
	if resp.Error != nil {
		t.Fatalf("ping error: %+v", resp.Error)
	}
	if m := resultMap(t, resp); len(m) != 0 {
		t.Fatalf("ping result not empty: %v", m)
	}
}

func TestMCPToolsList(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	resp := decode(t, rpcCall(t, srv, "", `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	tools, _ := resultMap(t, resp)["tools"].([]interface{})
	got := map[string]bool{}
	for _, tt := range tools {
		td, _ := tt.(map[string]interface{})
		got[td["name"].(string)] = true
		if _, ok := td["inputSchema"]; !ok {
			t.Fatalf("tool %v missing inputSchema", td["name"])
		}
	}
	for _, want := range []string{"list_feeds", "list_folders", "list_articles", "get_article",
		"mark_read", "mark_unread", "star", "unstar", "save_to_instapaper", "mark_all_read"} {
		if !got[want] {
			t.Fatalf("missing tool %q", want)
		}
	}
}

func TestMCPAuth(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	srv.Username = "admin"
	srv.Password = "secret"
	body := `{"jsonrpc":"2.0","id":1,"method":"ping"}`

	if rec := rpcCall(t, srv, "", body); rec.Result().StatusCode != http.StatusUnauthorized {
		t.Fatalf("no token: status = %d, want 401", rec.Result().StatusCode)
	}
	if rec := rpcCall(t, srv, "wrong", body); rec.Result().StatusCode != http.StatusUnauthorized {
		t.Fatalf("wrong token: status = %d, want 401", rec.Result().StatusCode)
	}
	if rec := rpcCall(t, srv, srv.mcpToken(), body); rec.Result().StatusCode != http.StatusOK {
		t.Fatalf("good token: status = %d, want 200", rec.Result().StatusCode)
	}
}

func TestMCPGetReturns405(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	rec := httptest.NewRecorder()
	srv.handler().ServeHTTP(rec, httptest.NewRequest("GET", "/mcp", nil))
	if rec.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Result().StatusCode)
	}
}

func TestMCPMarkReadRoundTrip(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	id := items[0].Id
	text, isErr := callTextResult(t, srv, "mark_read", fmt.Sprintf(`{"id":%d}`, id))
	if isErr {
		t.Fatalf("unexpected error: %s", text)
	}
	if got := srv.db.GetItem(id); got == nil || got.Status != storage.READ {
		t.Fatalf("item status not READ: %+v", got)
	}
}

func TestMCPStarRoundTrip(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	id := items[1].Id
	if _, isErr := callTextResult(t, srv, "star", fmt.Sprintf(`{"id":%d}`, id)); isErr {
		t.Fatal("star returned error")
	}
	if got := srv.db.GetItem(id); got.Status != storage.STARRED {
		t.Fatalf("item status = %v, want STARRED", got.Status)
	}
}

func TestMCPListArticlesUnread(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	text, isErr := callTextResult(t, srv, "list_articles", `{"status":"unread","limit":50}`)
	if isErr {
		t.Fatalf("error: %s", text)
	}
	for _, it := range items {
		if !strings.Contains(text, fmt.Sprintf("[%d]", it.Id)) {
			t.Fatalf("listing missing item %d:\n%s", it.Id, text)
		}
	}
	if strings.Contains(text, "<p>") {
		t.Fatalf("listing leaked article body:\n%s", text)
	}
}

func TestMCPGetArticle(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	text, isErr := callTextResult(t, srv, "get_article", fmt.Sprintf(`{"id":%d}`, items[0].Id))
	if isErr {
		t.Fatalf("error: %s", text)
	}
	if !strings.Contains(text, "Hello world") {
		t.Fatalf("expected extracted body text, got:\n%s", text)
	}
}

func TestMCPGetArticleMissing(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	text, isErr := callTextResult(t, srv, "get_article", `{"id":999999}`)
	if !isErr || !strings.Contains(text, "not found") {
		t.Fatalf("expected not-found isError, got isErr=%v text=%q", isErr, text)
	}
}

func TestMCPSaveToInstapaperNoCreds(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	text, isErr := callTextResult(t, srv, "save_to_instapaper", fmt.Sprintf(`{"id":%d}`, items[0].Id))
	if !isErr || !strings.Contains(text, "credentials") {
		t.Fatalf("expected credentials isError, got isErr=%v text=%q", isErr, text)
	}
}

func TestMCPMarkAllRead(t *testing.T) {
	srv, feed, _ := mcpTestServer(t)
	if _, isErr := callTextResult(t, srv, "mark_all_read", fmt.Sprintf(`{"feed_id":%d}`, feed.Id)); isErr {
		t.Fatal("mark_all_read returned error")
	}
	unread := storage.UNREAD
	if items := srv.db.ListItems(storage.ItemFilter{FeedID: &feed.Id, Status: &unread}, 10, true, false); len(items) != 0 {
		t.Fatalf("expected 0 unread after mark_all_read, got %d", len(items))
	}
}

func TestMCPErrorCodes(t *testing.T) {
	srv, _, _ := mcpTestServer(t)
	cases := []struct {
		name string
		body string
		code int
	}{
		{"unknown method", `{"jsonrpc":"2.0","id":1,"method":"bogus"}`, -32601},
		{"unknown tool", `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nope","arguments":{}}}`, -32602},
		{"parse error", `{not json`, -32700},
		{"batch", `[{"jsonrpc":"2.0","id":1,"method":"ping"}]`, -32600},
		{"invalid request", `{"jsonrpc":"1.0","id":1,"method":"ping"}`, -32600},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := decode(t, rpcCall(t, srv, "", tc.body))
			if resp.Error == nil || resp.Error.Code != tc.code {
				t.Fatalf("got %+v, want code %d", resp.Error, tc.code)
			}
		})
	}
}

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
	"time"

	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/storage"
)

// TestOpenAPIHandlerServesEmbeddedDoc exercises handleOpenAPI directly,
// independent of whether GET /v1/openapi.json has been wired into
// routes.go yet.
func TestOpenAPIHandlerServesEmbeddedDoc(t *testing.T) {
	s := NewServer(nil, "127.0.0.1:8000")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/v1/openapi.json", nil)
	ctx := &router.Context{Req: request, Out: recorder, Vars: map[string]string{}}
	s.handleOpenAPI(ctx)

	resp := recorder.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	assertOpenAPIDoc(t, body)
}

func TestOpenAPIHandlerRejectsNonGET(t *testing.T) {
	s := NewServer(nil, "127.0.0.1:8000")

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/v1/openapi.json", nil)
	ctx := &router.Context{Req: request, Out: recorder, Vars: map[string]string{}}
	s.handleOpenAPI(ctx)

	if recorder.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", recorder.Result().StatusCode)
	}
}

// TestOpenAPIRouteWired checks GET /v1/openapi.json end to end through the
// real router, so the document cannot become unreachable by losing its route
// registration.
func TestOpenAPIRouteWired(t *testing.T) {
	log.SetOutput(io.Discard)
	db, _ := storage.New(":memory:")
	log.SetOutput(os.Stderr)

	handler := NewServer(db, "127.0.0.1:8000").handler()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/v1/openapi.json", nil)
	handler.ServeHTTP(recorder, request)

	resp := recorder.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (route not wired into routes.go yet?)", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", ct)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	assertOpenAPIDoc(t, body)
}

// TestOpenAPIDocumentedPathsExistInRouter checks that every path documented
// in openapi.json, other than /v1/openapi.json itself (covered separately
// by TestOpenAPIRouteWired, since its route is wired outside this package's
// control), resolves in the router. This catches documentation drift if a
// route is renamed or removed without updating openapi.json.
func TestOpenAPIDocumentedPathsExistInRouter(t *testing.T) {
	log.SetOutput(io.Discard)
	db, _ := storage.New(":memory:")
	log.SetOutput(os.Stderr)

	// Seed one folder, one feed (with an icon), and one item so that the
	// {id} placeholders below resolve to real rows — otherwise handlers
	// such as GET /api/feeds/{id}/icon legitimately answer 404 for a
	// missing feed, which would be indistinguishable from the router
	// failing to match the route at all. Each id is assigned 1 because
	// this is a fresh :memory: database and each table's id sequence
	// starts independently at 1.
	db.CreateFolder("Folder")
	feed := db.CreateFeed("Feed", "", "http://example.com", "http://example.com/feed.xml", nil)
	icon := []byte{0x89, 0x50, 0x4e, 0x47}
	db.UpdateFeedIcon(feed.Id, &icon)
	db.CreateItems([]storage.Item{{
		GUID:   "guid-1",
		FeedId: feed.Id,
		Title:  "Item",
		Link:   "http://example.com/item",
		Date:   time.Now(),
	}})

	handler := NewServer(db, "127.0.0.1:8000").handler()

	var doc struct {
		Paths map[string]interface{} `json:"paths"`
	}
	if err := json.Unmarshal(openapiJSON, &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Paths) == 0 {
		t.Fatal("expected a non-empty paths object in openapi.json")
	}

	replacer := strings.NewReplacer("{id}", "1")
	for path := range doc.Paths {
		if path == "/v1/openapi.json" {
			continue
		}
		reqPath := replacer.Replace(path)

		recorder := httptest.NewRecorder()
		request := httptest.NewRequest("GET", reqPath, nil)
		handler.ServeHTTP(recorder, request)

		if recorder.Result().StatusCode == http.StatusNotFound {
			t.Errorf("documented path %q (requested as %q) does not resolve in the router", path, reqPath)
		}
	}
}

func assertOpenAPIDoc(t *testing.T, body []byte) {
	t.Helper()

	var doc map[string]interface{}
	if err := json.Unmarshal(body, &doc); err != nil {
		t.Fatalf("body is not valid JSON: %v", err)
	}

	openapiVersion, _ := doc["openapi"].(string)
	if !strings.HasPrefix(openapiVersion, "3.1") {
		t.Fatalf("expected openapi version 3.1.x, got %q", openapiVersion)
	}

	paths, ok := doc["paths"].(map[string]interface{})
	if !ok || len(paths) == 0 {
		t.Fatal("expected a non-empty paths object")
	}
}

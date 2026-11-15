package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

// The triage card renders list content with v-html, so GET /api/items must
// sanitize it the way the single-item view does: feed HTML must never reach
// the page with scripts or event handlers in it.
func TestItemListSanitizesContent(t *testing.T) {
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("storage.New: %v", err)
	}
	feed := db.CreateFeed("Hostile", "", "https://ex.com", "https://ex.com/feed", nil)
	db.CreateItems([]storage.Item{{
		GUID: "x1", FeedId: feed.Id, Title: "t", Link: "https://ex.com/1", Date: time.Now(),
		Content: `<p>hi</p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a><img src="/pic.jpg">`,
	}})
	log.SetOutput(os.Stderr)
	srv := NewServer(db, "127.0.0.1:8000")

	rec := httptest.NewRecorder()
	srv.handler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/items", nil))
	var body struct {
		List []storage.Item `json:"list"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || len(body.List) != 1 {
		t.Fatalf("decode /api/items: %v (%d items) %s", err, len(body.List), rec.Body.String())
	}
	content := body.List[0].Content
	for _, bad := range []string{"onerror", "<script", "javascript:"} {
		if strings.Contains(content, bad) {
			t.Errorf("list content still contains %q: %s", bad, content)
		}
	}
	if !strings.Contains(content, "https://ex.com/pic.jpg") {
		t.Errorf("relative image not resolved against the item link: %s", content)
	}
}

package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

func feedHealthServer(t *testing.T) (*Server, *storage.Storage, storage.Item) {
	t.Helper()
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("storage.New: %v", err)
	}
	feed := db.CreateFeed("Feed", "", "https://ex.com", "https://ex.com/feed", nil)
	db.CreateItems([]storage.Item{{GUID: "a", FeedId: feed.Id, Title: "a", Date: time.Now()}})
	log.SetOutput(os.Stderr)
	items := db.ListItems(storage.ItemFilter{}, 1, true, false)
	if len(items) != 1 {
		t.Fatal("no item")
	}
	return NewServer(db, "127.0.0.1:8000"), db, items[0]
}

func getHealth(t *testing.T, srv *Server, query string) (int, []storage.FeedHealth) {
	t.Helper()
	rec := httptest.NewRecorder()
	srv.handler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/feeds/health"+query, nil))
	var list []storage.FeedHealth
	if rec.Code == http.StatusOK {
		if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
			t.Fatalf("decode: %v %s", err, rec.Body.String())
		}
	}
	return rec.Code, list
}

// The reader says an item was opened through the update it already makes;
// the health report then counts it as engaged.
func TestItemOpenedFeedsHealth(t *testing.T) {
	srv, _, item := feedHealthServer(t)

	code, list := getHealth(t, srv, "")
	if code != http.StatusOK || len(list) != 1 || list[0].Arrived != 1 || list[0].Opened != 0 {
		t.Fatalf("before open: %d %+v", code, list)
	}

	rec := httptest.NewRecorder()
	path := "/api/items/" + strconv.FormatInt(item.Id, 10)
	srv.handler().ServeHTTP(rec, httptest.NewRequest("PUT", path, strings.NewReader(`{"opened":true}`)))
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT opened: %d", rec.Code)
	}

	_, list = getHealth(t, srv, "?days=7")
	if list[0].Opened != 1 || list[0].Engaged != 1 || list[0].Unread != 1 {
		t.Errorf("after open: %+v (opening is not reading: status stays unread)", list[0])
	}
}

func TestFeedHealthRejectsBadInput(t *testing.T) {
	srv, _, _ := feedHealthServer(t)
	if code, _ := getHealth(t, srv, "?days=soon"); code != http.StatusBadRequest {
		t.Errorf("days=soon: got %d, want 400", code)
	}
	rec := httptest.NewRecorder()
	srv.handler().ServeHTTP(rec, httptest.NewRequest("POST", "/api/feeds/health", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST: got %d, want 405", rec.Code)
	}
}

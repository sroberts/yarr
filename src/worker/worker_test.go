package worker

import (
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/parser"
	"github.com/nkanaev/yarr/src/storage"
)

func TestConvertItems_Empty(t *testing.T) {
	feed := storage.Feed{Id: 1}
	result := ConvertItems(nil, feed)
	if len(result) != 0 {
		t.Fatalf("expected 0 items, got %d", len(result))
	}
}

func TestConvertItems_BasicFields(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	feed := storage.Feed{Id: 42}

	items := []parser.Item{
		{
			GUID:    "guid-1",
			Title:   "Test Article",
			URL:     "https://example.com/article",
			Content: "<p>Hello</p>",
			Date:    now,
		},
	}

	result := ConvertItems(items, feed)
	if len(result) != 1 {
		t.Fatalf("expected 1 item, got %d", len(result))
	}

	got := result[0]
	if got.GUID != "guid-1" {
		t.Errorf("GUID: got %q, want %q", got.GUID, "guid-1")
	}
	if got.FeedId != 42 {
		t.Errorf("FeedId: got %d, want 42", got.FeedId)
	}
	if got.Title != "Test Article" {
		t.Errorf("Title: got %q", got.Title)
	}
	if got.Link != "https://example.com/article" {
		t.Errorf("Link: got %q", got.Link)
	}
	if got.Content != "<p>Hello</p>" {
		t.Errorf("Content: got %q", got.Content)
	}
	if !got.Date.Equal(now) {
		t.Errorf("Date: got %v, want %v", got.Date, now)
	}
	if got.Status != storage.UNREAD {
		t.Errorf("Status: got %d, want UNREAD (%d)", got.Status, storage.UNREAD)
	}
}

func TestConvertItems_MediaLinks(t *testing.T) {
	feed := storage.Feed{Id: 1}
	items := []parser.Item{
		{
			GUID: "guid-media",
			MediaLinks: []parser.MediaLink{
				{URL: "https://example.com/audio.mp3", Type: "audio/mpeg", Description: "Episode 1"},
				{URL: "https://example.com/video.mp4", Type: "video/mp4", Description: ""},
			},
		},
	}

	result := ConvertItems(items, feed)
	if len(result[0].MediaLinks) != 2 {
		t.Fatalf("expected 2 media links, got %d", len(result[0].MediaLinks))
	}

	want := storage.MediaLinks{
		{URL: "https://example.com/audio.mp3", Type: "audio/mpeg", Description: "Episode 1"},
		{URL: "https://example.com/video.mp4", Type: "video/mp4", Description: ""},
	}
	if !reflect.DeepEqual(result[0].MediaLinks, want) {
		t.Errorf("MediaLinks mismatch:\ngot:  %+v\nwant: %+v", result[0].MediaLinks, want)
	}
}

func TestConvertItems_MultipleItems(t *testing.T) {
	feed := storage.Feed{Id: 5}
	items := []parser.Item{
		{GUID: "a", Title: "First"},
		{GUID: "b", Title: "Second"},
		{GUID: "c", Title: "Third"},
	}

	result := ConvertItems(items, feed)
	if len(result) != 3 {
		t.Fatalf("expected 3 items, got %d", len(result))
	}
	for i, item := range result {
		if item.FeedId != 5 {
			t.Errorf("item[%d].FeedId: got %d, want 5", i, item.FeedId)
		}
		if item.Status != storage.UNREAD {
			t.Errorf("item[%d].Status: got %d, want UNREAD", i, item.Status)
		}
	}
}

func TestConvertItems_NoMediaLinks(t *testing.T) {
	feed := storage.Feed{Id: 1}
	items := []parser.Item{
		{GUID: "no-media"},
	}

	result := ConvertItems(items, feed)
	if result[0].MediaLinks == nil {
		t.Fatal("MediaLinks should be empty slice, not nil")
	}
	if len(result[0].MediaLinks) != 0 {
		t.Fatalf("expected 0 media links, got %d", len(result[0].MediaLinks))
	}
}

func TestGetCharset(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		want        string
	}{
		{"utf-8", "text/xml; charset=utf-8", "utf-8"},
		{"iso-8859-1", "text/html; charset=iso-8859-1", "iso-8859-1"},
		{"no charset", "text/html", ""},
		{"empty", "", ""},
		{"invalid charset", "text/html; charset=bogus-encoding-xyz", ""},
		{"windows-1252", "text/xml; charset=windows-1252", "windows-1252"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := &http.Response{
				Header: http.Header{"Content-Type": []string{tt.contentType}},
			}
			got := getCharset(res)
			if got != tt.want {
				t.Errorf("getCharset(%q) = %q, want %q", tt.contentType, got, tt.want)
			}
		})
	}
}

func TestSetVersion(t *testing.T) {
	SetVersion("2.6")
	if client.userAgent != "Yarr/2.6" {
		t.Errorf("expected user agent 'Yarr/2.6', got %q", client.userAgent)
	}
	// Restore default
	SetVersion("1.0")
}

// --- network paths (httptest) ---

const testRSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Test Feed</title>
<link>http://example.com</link>
<item><title>Item 1</title><link>http://example.com/1</link><guid>g1</guid></item>
<item><title>Item 2</title><link>http://example.com/2</link><guid>g2</guid></item>
</channel></rss>`

func newTestStorage(t *testing.T) *storage.Storage {
	t.Helper()
	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	log.SetOutput(os.Stderr)
	if err != nil {
		t.Fatalf("storage.New: %v", err)
	}
	return db
}

func TestGetBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("hello body"))
	}))
	defer srv.Close()
	body, err := GetBody(srv.URL)
	if err != nil {
		t.Fatalf("GetBody: %v", err)
	}
	if body != "hello body" {
		t.Fatalf("got %q", body)
	}
}

func TestDiscoverFeed_Direct(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/rss+xml")
		w.Write([]byte(testRSS))
	}))
	defer srv.Close()
	res, err := DiscoverFeed(srv.URL)
	if err != nil {
		t.Fatalf("DiscoverFeed: %v", err)
	}
	if res.Feed == nil || res.FeedLink != srv.URL {
		t.Fatalf("expected direct feed, got %+v", res)
	}
	if len(res.Feed.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(res.Feed.Items))
	}
}

func TestDiscoverFeed_MultipleSources(t *testing.T) {
	var base string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<html><head>
			<link rel="alternate" type="application/rss+xml" title="Feed A" href="` + base + `/a">
			<link rel="alternate" type="application/atom+xml" title="Feed B" href="` + base + `/b">
			</head><body>hi</body></html>`))
	}))
	defer srv.Close()
	base = srv.URL
	res, err := DiscoverFeed(srv.URL)
	if err != nil {
		t.Fatalf("DiscoverFeed: %v", err)
	}
	if len(res.Sources) != 2 {
		t.Fatalf("expected 2 sources, got %d (%+v)", len(res.Sources), res.Sources)
	}
}

func TestDiscoverFeed_Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	if _, err := DiscoverFeed(srv.URL); err == nil {
		t.Fatal("expected error on 404")
	}
}

func TestListItems(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/rss+xml")
		w.Write([]byte(testRSS))
	}))
	defer srv.Close()
	db := newTestStorage(t)
	feed := db.CreateFeed("Test", "", "http://example.com", srv.URL, nil)
	items, err := listItems(*feed, db)
	if err != nil {
		t.Fatalf("listItems: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
}

func TestRefreshFeeds_EndToEnd(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/rss+xml")
		w.Write([]byte(testRSS))
	}))
	defer srv.Close()
	db := newTestStorage(t)
	feed := db.CreateFeed("Test", "", "http://example.com", srv.URL, nil)

	log.SetOutput(io.Discard)
	defer log.SetOutput(os.Stderr)
	w := NewWorker(db)
	w.RefreshFeeds()

	// wait for the async refresher to drain
	deadline := time.Now().Add(5 * time.Second)
	for w.FeedsPending() > 0 {
		if time.Now().After(deadline) {
			t.Fatal("refresh did not finish in time")
		}
		time.Sleep(20 * time.Millisecond)
	}

	items := db.ListItems(storage.ItemFilter{FeedID: &feed.Id}, 10, true, false)
	if len(items) != 2 {
		t.Fatalf("expected 2 items after refresh, got %d", len(items))
	}
	if errs := db.GetFeedErrors(); len(errs) != 0 {
		t.Fatalf("unexpected feed errors: %v", errs)
	}
}

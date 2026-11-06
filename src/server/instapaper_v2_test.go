package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

// stubInstapaper points both Instapaper endpoints at one test server and
// restores them afterwards.
func stubInstapaper(t *testing.T, h http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	origV1, origV2 := instapaperAddURL, instapaperBookmarksURL
	instapaperAddURL, instapaperBookmarksURL = srv.URL+"/api/add", srv.URL+"/api/2/bookmarks"
	t.Cleanup(func() { instapaperAddURL, instapaperBookmarksURL = origV1, origV2 })
}

func TestInstapaperSaveBookmark_RequestShape(t *testing.T) {
	var got struct {
		method, path, auth, ctype string
		body                      map[string]interface{}
	}
	stubInstapaper(t, func(w http.ResponseWriter, r *http.Request) {
		got.method, got.path = r.Method, r.URL.Path
		got.auth, got.ctype = r.Header.Get("Authorization"), r.Header.Get("Content-Type")
		json.NewDecoder(r.Body).Decode(&got.body)
		w.WriteHeader(http.StatusOK)
		io.WriteString(w, `{"bookmark_id": 1}`)
	})

	if err := InstapaperSaveBookmark("tok", "https://example.com/a", "A title"); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.method != "POST" || got.path != "/api/2/bookmarks" {
		t.Errorf("request = %s %s, want POST /api/2/bookmarks", got.method, got.path)
	}
	if got.auth != "Bearer tok" {
		t.Errorf("Authorization = %q, want bearer token", got.auth)
	}
	if got.ctype != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got.ctype)
	}
	if got.body["url"] != "https://example.com/a" || got.body["title"] != "A title" {
		t.Errorf("body = %v, want url and title", got.body)
	}
}

func TestInstapaperSaveBookmark_OmitsEmptyTitle(t *testing.T) {
	var body map[string]interface{}
	stubInstapaper(t, func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&body)
	})
	if err := InstapaperSaveBookmark("tok", "https://example.com/a", ""); err != nil {
		t.Fatal(err)
	}
	if _, ok := body["title"]; ok {
		t.Errorf("body = %v, want no title key", body)
	}
}

func TestInstapaperSaveBookmark_StatusMessages(t *testing.T) {
	cases := map[int]string{
		http.StatusBadRequest:          "couldn't save this link",
		http.StatusUnauthorized:        "rejected the access token",
		http.StatusForbidden:           "refused the save",
		http.StatusTooManyRequests:     "rate limiting",
		http.StatusInternalServerError: "server error",
	}
	for status, want := range cases {
		stubInstapaper(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			io.WriteString(w, `{"error": "secret detail"}`)
		})
		err := InstapaperSaveBookmark("tok", "https://example.com/a", "t")
		var se *InstapaperStatusError
		if !errors.As(err, &se) || se.Status != status {
			t.Fatalf("status %d: err = %v, want InstapaperStatusError", status, err)
		}
		msg := instapaperMessage(err)
		if !strings.Contains(msg, want) {
			t.Errorf("status %d: message %q, want it to contain %q", status, msg, want)
		}
		if strings.Contains(msg, "secret detail") {
			t.Errorf("status %d: message leaks the response body: %q", status, msg)
		}
	}
}

func newInstapaperTestServer(t *testing.T) *Server {
	t.Helper()
	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	return NewServer(db, "127.0.0.1:8000")
}

// The environment's token wins, then the Settings token, then the legacy
// username and password on the Simple API.
func TestInstapaperSave_Precedence(t *testing.T) {
	var hits []string
	stubInstapaper(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/add" {
			user, _, _ := r.BasicAuth()
			hits = append(hits, "v1:"+user)
			w.WriteHeader(http.StatusCreated)
			return
		}
		hits = append(hits, "v2:"+r.Header.Get("Authorization"))
	})

	s := newInstapaperTestServer(t)
	if err := s.instapaperSave("https://example.com", "t"); !errors.Is(err, errInstapaperNotConfigured) {
		t.Fatalf("nothing configured: err = %v, want errInstapaperNotConfigured", err)
	}

	s.db.UpdateSettings(map[string]interface{}{"instapaper_username": "me", "instapaper_password": "pw"})
	s.instapaperSave("https://example.com", "t")
	s.db.UpdateSettings(map[string]interface{}{"instapaper_token": "settings-tok"})
	s.instapaperSave("https://example.com", "t")
	s.InstapaperToken = "env-tok"
	s.instapaperSave("https://example.com", "t")

	want := []string{"v1:me", "v2:Bearer settings-tok", "v2:Bearer env-tok"}
	if strings.Join(hits, ",") != strings.Join(want, ",") {
		t.Errorf("calls = %v, want %v", hits, want)
	}
}

// Neither the password nor the token is ever sent to the browser.
func TestPublicSettings_HidesInstapaperSecrets(t *testing.T) {
	s := newInstapaperTestServer(t)
	s.db.UpdateSettings(map[string]interface{}{
		"instapaper_username": "me",
		"instapaper_password": "hunter2",
		"instapaper_token":    "tok-123",
	})

	for _, path := range []string{"/api/settings", "/"} {
		rec := httptest.NewRecorder()
		s.handler().ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		body := rec.Body.String()
		if strings.Contains(body, "hunter2") || strings.Contains(body, "tok-123") {
			t.Errorf("GET %s leaks an Instapaper secret", path)
		}
	}

	settings := s.publicSettings()
	if settings["instapaper_password_set"] != true || settings["instapaper_token_set"] != true || settings["instapaper_token_env"] != false {
		t.Errorf("flags = %v/%v/%v, want true/true/false",
			settings["instapaper_password_set"], settings["instapaper_token_set"], settings["instapaper_token_env"])
	}
	if settings["instapaper_username"] != "me" {
		t.Errorf("username = %v, want it kept", settings["instapaper_username"])
	}
}

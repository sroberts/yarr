package server

import (
	"io"
	"log"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

// The healthcheck must report "not ready" rather than lie while the server is
// still starting up or is draining: a supervisor restarts anything that answers
// 2xx and then fails to serve.
func TestHealthEndpointNotReady(t *testing.T) {
	log.SetOutput(io.Discard)
	db, _ := storage.New(":memory:")
	log.SetOutput(os.Stderr)

	srv := NewServer(db, "127.0.0.1:8000")
	srv.ready.Store(false)
	handler := srv.handler()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("GET", "/up", nil)
	handler.ServeHTTP(recorder, request)

	if recorder.Result().StatusCode != 503 {
		t.Fatalf("expected 503 while not ready, got %d", recorder.Result().StatusCode)
	}

	// ...and 2xx once startup has finished.
	srv.ready.Store(true)
	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest("GET", "/up", nil))
	if recorder.Result().StatusCode != 200 {
		t.Fatalf("expected 200 once ready, got %d", recorder.Result().StatusCode)
	}
}

// A broken database must not make the healthcheck fail: restarting the process
// cannot fix the database, it only discards a working process.
func TestHealthEndpointIgnoresDatabase(t *testing.T) {
	log.SetOutput(io.Discard)
	db, _ := storage.New(":memory:")
	log.SetOutput(os.Stderr)

	srv := NewServer(db, "127.0.0.1:8000")
	handler := srv.handler()
	if err := db.Close(); err != nil {
		t.Fatalf("failed to close db: %v", err)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest("GET", "/up", nil))

	if recorder.Result().StatusCode != 200 {
		t.Fatalf("expected 200 with a dead database, got %d", recorder.Result().StatusCode)
	}
}

package server

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nkanaev/yarr/src/storage"
)

// Behind the gateway yarr has no credentials, and the origin guard lets GETs
// through, so a Fever mark must not work as a GET: a cross-site link or image
// would otherwise change state with the user's gateway login.
func TestGatewayFeverMarkRequiresPost(t *testing.T) {
	srv, _, items := mcpTestServer(t)
	srv.OutpostGateway = true
	id := items[0].Id

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", fmt.Sprintf("/fever/?api&mark=item&as=read&id=%d", id), nil)
	srv.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET mark behind the gateway: got %d, want 405", rec.Code)
	}
	if got := srv.db.GetItem(id).Status; got != storage.UNREAD {
		t.Errorf("GET mark changed the item: status %v", got)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("POST", fmt.Sprintf("/fever/?api&mark=item&as=read&id=%d", id), nil)
	srv.handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("POST mark behind the gateway: got %d, want 200", rec.Code)
	}
	if got := srv.db.GetItem(id).Status; got != storage.READ {
		t.Errorf("POST mark did not mark the item read: status %v", got)
	}
}

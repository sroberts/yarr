package server

import (
	_ "embed"
	"net/http"

	"github.com/nkanaev/yarr/src/server/router"
)

//go:embed openapi.json
var openapiJSON []byte

// handleOpenAPI serves the hand-written OpenAPI 3.1 document describing
// yarr's HTTP API (see openapi.json). It is meant to be reachable without
// authentication — see the auth middleware's Public path list in
// routes.go — so that external tooling (e.g. Outpost's Hermes SKILL.md
// generator) can fetch it without credentials.
func (s *Server) handleOpenAPI(c *router.Context) {
	if c.Req.Method != "GET" {
		c.Out.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	c.Out.Header().Set("Content-Type", "application/json")
	c.Out.WriteHeader(http.StatusOK)
	_, _ = c.Out.Write(openapiJSON)
}

package server

import (
	"github.com/nkanaev/yarr/src/server/mcp"
	"github.com/nkanaev/yarr/src/server/router"
)

// handleMCP serves the Model Context Protocol endpoint. It is registered like
// any other route, so it sits behind the same authentication as the web UI.
func (s *Server) handleMCP(c *router.Context) {
	(&mcp.Handler{DB: s.db, Version: s.Version}).Handle(c)
}

package server

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"log"
	"net/http"

	"github.com/nkanaev/yarr/src/server/router"
)

//go:embed openapi.json
var openapiJSON []byte

// document returns the embedded spec with info.version replaced by the running
// release, so a public document cannot go on advertising whatever version was
// literal in the file when it was written.
func (s *Server) document() []byte {
	s.openapiOnce.Do(func() {
		s.openapiDoc = openapiJSON
		if s.Version == "" {
			return
		}
		var doc map[string]interface{}
		if err := json.Unmarshal(openapiJSON, &doc); err != nil {
			log.Printf("openapi: %v", err)
			return
		}
		info, ok := doc["info"].(map[string]interface{})
		if !ok {
			return
		}
		info["version"] = s.Version

		var out bytes.Buffer
		encoder := json.NewEncoder(&out)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(doc); err != nil {
			log.Printf("openapi: %v", err)
			return
		}
		s.openapiDoc = out.Bytes()
	})
	return s.openapiDoc
}

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
	_, _ = c.Out.Write(s.document())
}

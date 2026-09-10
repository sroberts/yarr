// Package mcp serves yarr's Model Context Protocol endpoint over Streamable
// HTTP: one JSON-RPC 2.0 request per POST, one response, no session state.
package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/storage"
)

const (
	// latestVersion is what we answer with when a client asks for a revision
	// we do not know.
	latestVersion = "2025-06-18"

	maxRequestBytes = 1 << 20
)

// supportedVersions are the protocol revisions this server behaves correctly
// under. It serves all of them identically.
var supportedVersions = []string{"2025-06-18", "2025-03-26", "2024-11-05"}

const instructions = "yarr is a self-hosted RSS/Atom reader. Use list_feeds to see subscriptions and unread counts, list_items to search or browse articles, get_item to read one in full, and mark_item / mark_all_read to change read state."

// Handler answers MCP requests against a yarr database.
type Handler struct {
	DB      *storage.Storage
	Version string
}

func (h *Handler) version() string {
	if h.Version == "" {
		return "dev"
	}
	return h.Version
}

func (h *Handler) Handle(c *router.Context) {
	w, r := c.Out, c.Req

	if r.Method != http.MethodPost {
		// One request, one response: there is no SSE stream to GET and no
		// session to DELETE.
		w.Header().Set("Allow", "POST")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !originAllowed(r) {
		w.WriteHeader(http.StatusForbidden)
		return
	}

	// The MCP-Protocol-Version request header is ignored on purpose. The spec
	// says to answer 400 when it names a revision the server does not support,
	// but this server keeps no session and behaves identically across every
	// revision it serves, so being strict about it would only break clients in
	// exchange for nothing.

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			return
		}
		writeError(w, http.StatusBadRequest, nil, codeParseError, "Parse error.")
		return
	}

	if !json.Valid(body) {
		writeError(w, http.StatusBadRequest, nil, codeParseError, "Parse error: body is not valid JSON.")
		return
	}
	// MCP dropped batching in 2025-06-18 and yarr never supported it.
	if head := bytes.TrimLeft(body, " \t\r\n"); len(head) > 0 && head[0] == '[' {
		writeError(w, http.StatusBadRequest, nil, codeInvalidRequest, "JSON-RPC batching is not supported.")
		return
	}

	var req request
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, nil, codeInvalidRequest, "Invalid Request: expected a JSON-RPC object.")
		return
	}
	if req.JSONRPC != "2.0" || req.Method == "" {
		writeError(w, http.StatusBadRequest, req.ID, codeInvalidRequest, `Invalid Request: "jsonrpc":"2.0" and a method are required.`)
		return
	}
	// MCP forbids a null request id, so null is a malformed request rather
	// than a notification.
	if req.hasNullID() {
		writeError(w, http.StatusBadRequest, nullID, codeInvalidRequest, "Invalid Request: id must not be null.")
		return
	}

	// Notifications get no response at all, whether or not we know the method.
	if req.isNotification() || strings.HasPrefix(req.Method, "notifications/") {
		w.WriteHeader(http.StatusAccepted)
		return
	}

	h.dispatch(w, req)
}

func (h *Handler) dispatch(w http.ResponseWriter, req request) {
	switch req.Method {
	case "initialize":
		h.initialize(w, req)
	case "ping":
		// The spec's EmptyResult: an empty object, not null.
		writeResult(w, req.ID, struct{}{})
	case "tools/list":
		// The tool list is short and fixed, so it is never paginated and
		// params.cursor is ignored.
		writeResult(w, req.ID, map[string]interface{}{"tools": tools})
	case "tools/call":
		h.callTool(w, req)
	default:
		writeError(w, http.StatusOK, req.ID, codeMethodNotFound, "Unknown method: "+req.Method)
	}
}

func (h *Handler) initialize(w http.ResponseWriter, req request) {
	// An unknown or missing version is answered with the latest revision we
	// speak rather than an error: the client decides whether it can live with
	// that, and every revision we serve behaves the same here anyway.
	version := latestVersion
	if len(req.Params) > 0 {
		var params struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		if err := json.Unmarshal(req.Params, &params); err == nil {
			for _, v := range supportedVersions {
				if params.ProtocolVersion == v {
					version = v
					break
				}
			}
		}
	}

	// Tools are the only capability. No session id is issued either: the
	// server keeps no state, and nothing here requires that initialize was
	// called first.
	writeResult(w, req.ID, map[string]interface{}{
		"protocolVersion": version,
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{},
		},
		"serverInfo": map[string]interface{}{
			"name":    "yarr",
			"title":   "yarr",
			"version": h.version(),
		},
		"instructions": instructions,
	})
}

func (h *Handler) callTool(w http.ResponseWriter, req request) {
	var params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if len(req.Params) > 0 {
		if err := json.Unmarshal(req.Params, &params); err != nil {
			writeError(w, http.StatusOK, req.ID, codeInvalidParams, "Invalid params: "+err.Error())
			return
		}
	}
	if params.Name == "" {
		writeError(w, http.StatusOK, req.ID, codeInvalidParams, "Invalid params: a tool name is required.")
		return
	}
	t := findTool(params.Name)
	if t == nil {
		writeError(w, http.StatusOK, req.ID, codeInvalidParams, "Unknown tool: "+params.Name)
		return
	}

	args := params.Arguments
	if len(args) == 0 {
		args = json.RawMessage("{}")
	}

	result, rpcerr := h.run(t, args)
	if rpcerr != nil {
		writeError(w, http.StatusOK, req.ID, rpcerr.Code, rpcerr.Message)
		return
	}
	writeResult(w, req.ID, capResult(result))
}

// run calls a tool, turning a panic into an internal error instead of letting
// it unwind into the http server.
func (h *Handler) run(t *tool, args json.RawMessage) (res *toolResult, rpcerr *rpcError) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("mcp: tool %s panicked: %v", t.Name, r)
			res, rpcerr = nil, &rpcError{Code: codeInternalError, Message: "Internal error."}
		}
	}()
	return t.fn(h.DB, args)
}

// originAllowed implements the Streamable HTTP transport's DNS-rebinding
// protection: a browser-supplied Origin must match the host being served or be
// loopback. Non-browser clients send no Origin and pass straight through.
func originAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "" {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) || strings.EqualFold(host, hostname(r.Host)) {
		return true
	}
	return isLoopback(host)
}

func hostname(hostport string) string {
	if host, _, err := net.SplitHostPort(hostport); err == nil {
		return host
	}
	return hostport
}

func isLoopback(host string) bool {
	if strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

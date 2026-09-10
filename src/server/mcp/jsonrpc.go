package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
)

// JSON-RPC 2.0 error codes. MCP adds none of its own.
const (
	codeParseError     = -32700
	codeInvalidRequest = -32600
	codeMethodNotFound = -32601
	codeInvalidParams  = -32602
	codeInternalError  = -32603
)

// request is one JSON-RPC call. ID stays raw so that an absent id (which makes
// the call a notification) is distinguishable from an explicit null, and so
// that the id echoes back with the type the client sent it as.
type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

func (r request) isNotification() bool {
	return len(r.ID) == 0
}

func (r request) hasNullID() bool {
	return string(bytes.TrimSpace(r.ID)) == "null"
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

var nullID = json.RawMessage("null")

const encodeFailure = `{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"failed to encode result"}}`

// writeResponse marshals and sends one response.
//
// router.Context.JSON is deliberately not used: it calls log.Fatal when
// marshalling fails, which would take the process down over a single bad
// request. Here a marshal failure turns into an internal-error response.
func writeResponse(w http.ResponseWriter, status int, resp response) {
	if len(resp.ID) == 0 {
		resp.ID = nullID
	}
	body, err := json.Marshal(resp)
	if err != nil {
		status = http.StatusOK
		fallback := response{
			JSONRPC: "2.0",
			ID:      resp.ID,
			Error:   &rpcError{Code: codeInternalError, Message: "failed to encode result"},
		}
		if body, err = json.Marshal(fallback); err != nil {
			body = []byte(encodeFailure)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeResult(w http.ResponseWriter, id json.RawMessage, result interface{}) {
	writeResponse(w, http.StatusOK, response{JSONRPC: "2.0", ID: id, Result: result})
}

// writeError sends an error response. Failures that stop a request before it
// reaches a method carry an HTTP status of their own; everything a method
// itself rejects is a 200 with an error member.
func writeError(w http.ResponseWriter, status int, id json.RawMessage, code int, message string) {
	writeResponse(w, status, response{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: code, Message: message}})
}

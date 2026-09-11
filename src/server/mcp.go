package server

import (
	"bytes"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/nkanaev/yarr/src/content/htmlutil"
	"github.com/nkanaev/yarr/src/content/sanitizer"
	"github.com/nkanaev/yarr/src/server/auth"
	"github.com/nkanaev/yarr/src/server/router"
	"github.com/nkanaev/yarr/src/storage"
	"github.com/nkanaev/yarr/src/worker"
)

// yarr exposes a Model Context Protocol (MCP) server over Streamable HTTP at
// POST /mcp so AI clients (Claude Code / Claude Desktop) can browse and triage
// articles. It speaks hand-rolled JSON-RPC 2.0 — no external dependency — and
// mirrors the Fever API's bearer-style auth (see fever.go).

const mcpProtocolVersion = "2025-06-18"

// mcpSupportedVersions are protocol revisions we will echo back during the
// initialize handshake if the client requests one of them.
var mcpSupportedVersions = map[string]bool{
	"2025-06-18": true,
	"2025-03-26": true,
	"2024-11-05": true,
}

const mcpMaxBody = 1 << 20   // 1 MiB request cap
const mcpMaxContent = 50_000 // truncate article bodies past this many runes

// --- JSON-RPC 2.0 envelope ---

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"` // string|number|null; absent => notification
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  interface{}     `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func rpcOK(id json.RawMessage, result interface{}) rpcResponse {
	return rpcResponse{JSONRPC: "2.0", ID: id, Result: result}
}

func rpcErr(id json.RawMessage, code int, message string) rpcResponse {
	return rpcResponse{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: code, Message: message}}
}

// --- auth (mirrors feverAuth) ---

// mcpToken derives the bearer token from the configured credentials, using the
// same scheme as the Fever API: md5(username:password) in hex.
func (s *Server) mcpToken() string {
	sum := md5.Sum([]byte(fmt.Sprintf("%s:%s", s.Username, s.Password)))
	return fmt.Sprintf("%x", sum[:])
}

func (s *Server) mcpAuth(c *router.Context) bool {
	if s.Username == "" || s.Password == "" {
		return true // auth disabled when no credentials are configured (parity with Fever)
	}
	header := c.Req.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	return auth.StringsEqual(token, s.mcpToken())
}

// --- handler ---

func (s *Server) handleMCP(c *router.Context) {
	if c.Req.Method != "POST" {
		c.Out.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !s.mcpAuth(c) {
		c.Out.Header().Set("WWW-Authenticate", "Bearer")
		c.Out.WriteHeader(http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Req.Body, mcpMaxBody))
	if err != nil {
		c.JSON(http.StatusOK, rpcErr(nil, -32700, "parse error"))
		return
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		c.JSON(http.StatusOK, rpcErr(nil, -32600, "batch requests are not supported"))
		return
	}

	var req rpcRequest
	if err := json.Unmarshal(trimmed, &req); err != nil {
		c.JSON(http.StatusOK, rpcErr(nil, -32700, "parse error"))
		return
	}
	if req.JSONRPC != "2.0" || req.Method == "" {
		c.JSON(http.StatusOK, rpcErr(req.ID, -32600, "invalid request"))
		return
	}

	isNotification := len(req.ID) == 0

	switch req.Method {
	case "initialize":
		c.JSON(http.StatusOK, rpcOK(req.ID, s.mcpInitialize(req.Params)))
	case "notifications/initialized":
		c.Out.WriteHeader(http.StatusAccepted) // notification: no response body
	case "ping":
		c.JSON(http.StatusOK, rpcOK(req.ID, map[string]interface{}{}))
	case "tools/list":
		c.JSON(http.StatusOK, rpcOK(req.ID, map[string]interface{}{"tools": mcpTools}))
	case "tools/call":
		c.JSON(http.StatusOK, s.mcpToolsCall(req.ID, req.Params))
	default:
		if isNotification {
			c.Out.WriteHeader(http.StatusAccepted) // ignore unknown notifications
			return
		}
		c.JSON(http.StatusOK, rpcErr(req.ID, -32601, "method not found"))
	}
}

func (s *Server) mcpInitialize(params json.RawMessage) map[string]interface{} {
	version := mcpProtocolVersion
	var p struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if json.Unmarshal(params, &p) == nil && mcpSupportedVersions[p.ProtocolVersion] {
		version = p.ProtocolVersion
	}
	return map[string]interface{}{
		"protocolVersion": version,
		"serverInfo":      map[string]interface{}{"name": "yarr", "version": s.Version},
		"capabilities":    map[string]interface{}{"tools": map[string]interface{}{}},
	}
}

// --- tools ---

type toolDef struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"inputSchema"`
}

func obj(props map[string]interface{}, required ...string) map[string]interface{} {
	schema := map[string]interface{}{"type": "object", "properties": props}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

var idSchema = obj(map[string]interface{}{
	"id": map[string]interface{}{"type": "integer", "description": "article id"},
}, "id")

var mcpTools = []toolDef{
	{"list_feeds", "List all subscribed feeds with their folder and unread/starred counts.", obj(nil)},
	{"list_folders", "List all folders.", obj(nil)},
	{"list_articles", "List articles, newest first. Filter by feed, folder, status, or a full-text search. Returns a compact list without article bodies; use get_article for the full text.", obj(map[string]interface{}{
		"feed_id":      map[string]interface{}{"type": "integer", "description": "only articles from this feed"},
		"folder_id":    map[string]interface{}{"type": "integer", "description": "only articles from feeds in this folder"},
		"status":       map[string]interface{}{"type": "string", "enum": []string{"unread", "read", "starred"}, "description": "only articles with this status"},
		"search":       map[string]interface{}{"type": "string", "description": "full-text search over title and content"},
		"limit":        map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
		"newest_first": map[string]interface{}{"type": "boolean", "default": true},
	})},
	{"get_article", "Get the full text of one article by id.", idSchema},
	{"mark_read", "Mark an article as read.", idSchema},
	{"mark_unread", "Mark an article as unread.", idSchema},
	{"star", "Star an article.", idSchema},
	{"unstar", "Remove the star from an article (marks it read).", idSchema},
	{"save_to_instapaper", "Save an article to Instapaper (requires Instapaper credentials in Settings). Marks the article read.", idSchema},
	{"mark_all_read", "Mark every article as read, optionally limited to one feed or folder.", obj(map[string]interface{}{
		"feed_id":   map[string]interface{}{"type": "integer", "description": "limit to this feed"},
		"folder_id": map[string]interface{}{"type": "integer", "description": "limit to this folder"},
	})},

	// --- library management ---
	{"subscribe", "Subscribe to a feed by URL. The URL may point at a feed or a web page (the feed is auto-discovered). If the page exposes several feeds, the candidates are returned so you can subscribe to a specific one.", obj(map[string]interface{}{
		"url":       map[string]interface{}{"type": "string", "description": "feed or web page URL"},
		"folder_id": map[string]interface{}{"type": "integer", "description": "optional folder to file the feed under"},
	}, "url")},
	{"unsubscribe", "Delete a feed and all its articles.", obj(map[string]interface{}{
		"feed_id": map[string]interface{}{"type": "integer", "description": "feed id"},
	}, "feed_id")},
	{"rename_feed", "Rename a feed.", obj(map[string]interface{}{
		"feed_id": map[string]interface{}{"type": "integer", "description": "feed id"},
		"title":   map[string]interface{}{"type": "string", "description": "new title"},
	}, "feed_id", "title")},
	{"move_feed", "Move a feed into a folder, or to no folder (omit folder_id).", obj(map[string]interface{}{
		"feed_id":   map[string]interface{}{"type": "integer", "description": "feed id"},
		"folder_id": map[string]interface{}{"type": "integer", "description": "destination folder id; omit to remove from any folder"},
	}, "feed_id")},
	{"create_folder", "Create a folder.", obj(map[string]interface{}{
		"title": map[string]interface{}{"type": "string", "description": "folder title"},
	}, "title")},
	{"rename_folder", "Rename a folder.", obj(map[string]interface{}{
		"folder_id": map[string]interface{}{"type": "integer", "description": "folder id"},
		"title":     map[string]interface{}{"type": "string", "description": "new title"},
	}, "folder_id", "title")},
	{"delete_folder", "Delete a folder. Its feeds are kept and moved to no folder.", obj(map[string]interface{}{
		"folder_id": map[string]interface{}{"type": "integer", "description": "folder id"},
	}, "folder_id")},
	{"refresh_feeds", "Trigger a background refresh of all feeds now.", obj(nil)},
	{"list_feed_errors", "List feeds that failed to fetch, with their error messages.", obj(nil)},
}

func textResult(text string, isError bool) map[string]interface{} {
	return map[string]interface{}{
		"content": []map[string]interface{}{{"type": "text", "text": text}},
		"isError": isError,
	}
}

func (s *Server) mcpToolsCall(id, params json.RawMessage) rpcResponse {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil || call.Name == "" {
		return rpcErr(id, -32602, "invalid params: tool name is required")
	}

	var result map[string]interface{}
	switch call.Name {
	case "list_feeds":
		result = s.toolListFeeds()
	case "list_folders":
		result = s.toolListFolders()
	case "list_articles":
		result = s.toolListArticles(call.Arguments)
	case "get_article":
		result = s.toolGetArticle(call.Arguments)
	case "mark_read":
		result = s.toolSetStatus(call.Arguments, storage.READ, "read")
	case "mark_unread":
		result = s.toolSetStatus(call.Arguments, storage.UNREAD, "unread")
	case "star":
		result = s.toolSetStatus(call.Arguments, storage.STARRED, "starred")
	case "unstar":
		result = s.toolSetStatus(call.Arguments, storage.READ, "unstarred")
	case "save_to_instapaper":
		result = s.toolSaveToInstapaper(call.Arguments)
	case "mark_all_read":
		result = s.toolMarkAllRead(call.Arguments)
	case "subscribe":
		result = s.toolSubscribe(call.Arguments)
	case "unsubscribe":
		result = s.toolUnsubscribe(call.Arguments)
	case "rename_feed":
		result = s.toolRenameFeed(call.Arguments)
	case "move_feed":
		result = s.toolMoveFeed(call.Arguments)
	case "create_folder":
		result = s.toolCreateFolder(call.Arguments)
	case "rename_folder":
		result = s.toolRenameFolder(call.Arguments)
	case "delete_folder":
		result = s.toolDeleteFolder(call.Arguments)
	case "refresh_feeds":
		result = s.toolRefreshFeeds()
	case "list_feed_errors":
		result = s.toolListFeedErrors()
	default:
		return rpcErr(id, -32602, "unknown tool: "+call.Name)
	}
	return rpcOK(id, result)
}

// itemID unmarshals the common {"id": N} argument shape.
func itemID(args json.RawMessage) (int64, bool) {
	var a struct {
		ID int64 `json:"id"`
	}
	if json.Unmarshal(args, &a) != nil || a.ID == 0 {
		return 0, false
	}
	return a.ID, true
}

func (s *Server) toolListFeeds() map[string]interface{} {
	feeds := s.db.ListFeeds()
	if len(feeds) == 0 {
		return textResult("no feeds subscribed", false)
	}
	stats := make(map[int64]storage.FeedStat)
	for _, st := range s.db.FeedStats() {
		stats[st.FeedId] = st
	}
	folders := make(map[int64]string)
	for _, f := range s.db.ListFolders() {
		folders[f.Id] = f.Title
	}
	var b strings.Builder
	for _, f := range feeds {
		folder := "none"
		if f.FolderId != nil {
			if name, ok := folders[*f.FolderId]; ok {
				folder = name
			}
		}
		st := stats[f.Id]
		fmt.Fprintf(&b, "[%d] %s — %s (folder: %s, unread: %d, starred: %d)\n",
			f.Id, f.Title, f.FeedLink, folder, st.UnreadCount, st.StarredCount)
	}
	return textResult(strings.TrimRight(b.String(), "\n"), false)
}

func (s *Server) toolListFolders() map[string]interface{} {
	folders := s.db.ListFolders()
	if len(folders) == 0 {
		return textResult("no folders", false)
	}
	var b strings.Builder
	for _, f := range folders {
		fmt.Fprintf(&b, "[%d] %s\n", f.Id, f.Title)
	}
	return textResult(strings.TrimRight(b.String(), "\n"), false)
}

func (s *Server) toolListArticles(args json.RawMessage) map[string]interface{} {
	var a struct {
		FeedID      *int64  `json:"feed_id"`
		FolderID    *int64  `json:"folder_id"`
		Status      *string `json:"status"`
		Search      *string `json:"search"`
		Limit       *int    `json:"limit"`
		NewestFirst *bool   `json:"newest_first"`
	}
	if len(args) > 0 {
		if err := json.Unmarshal(args, &a); err != nil {
			return textResult("invalid arguments: "+err.Error(), true)
		}
	}

	filter := storage.ItemFilter{FeedID: a.FeedID, FolderID: a.FolderID, Search: a.Search}
	if a.Status != nil {
		status, ok := storage.StatusValues[*a.Status]
		if !ok {
			return textResult("invalid status: must be one of unread, read, starred", true)
		}
		filter.Status = &status
	}

	limit := 20
	if a.Limit != nil {
		limit = *a.Limit
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	newestFirst := true
	if a.NewestFirst != nil {
		newestFirst = *a.NewestFirst
	}

	items := s.db.ListItems(filter, limit, newestFirst, false)
	if len(items) == 0 {
		return textResult("no articles match", false)
	}
	titles := make(map[int64]string)
	for _, f := range s.db.ListFeeds() {
		titles[f.Id] = f.Title
	}
	var b strings.Builder
	for _, it := range items {
		fmt.Fprintf(&b, "- [%d] %s — %s (%s, %s) %s\n",
			it.Id, it.Title, titles[it.FeedId],
			storage.StatusRepresentations[it.Status],
			it.Date.Format("2006-01-02 15:04"), it.Link)
	}
	return textResult(strings.TrimRight(b.String(), "\n"), false)
}

func (s *Server) toolGetArticle(args json.RawMessage) map[string]interface{} {
	id, ok := itemID(args)
	if !ok {
		return textResult("invalid arguments: 'id' (integer) is required", true)
	}
	item := s.db.GetItem(id)
	if item == nil {
		return textResult(fmt.Sprintf("article %d not found", id), true)
	}

	// Resolve relative links against the feed, mirroring handleItem.
	if !htmlutil.IsAPossibleLink(item.Link) {
		if feed := s.db.GetFeed(item.FeedId); feed != nil {
			item.Link = htmlutil.AbsoluteUrl(item.Link, feed.Link)
		}
	}
	text := htmlutil.ExtractText(sanitizer.Sanitize(item.Link, item.Content))
	text = strings.TrimSpace(text)
	if runes := []rune(text); len(runes) > mcpMaxContent {
		text = string(runes[:mcpMaxContent]) + "\n\n[truncated]"
	}

	feedTitle := ""
	if feed := s.db.GetFeed(item.FeedId); feed != nil {
		feedTitle = feed.Title
	}
	var b strings.Builder
	fmt.Fprintf(&b, "id: %d\n", item.Id)
	fmt.Fprintf(&b, "title: %s\n", item.Title)
	fmt.Fprintf(&b, "feed: %s\n", feedTitle)
	fmt.Fprintf(&b, "date: %s\n", item.Date.Format("2006-01-02 15:04"))
	fmt.Fprintf(&b, "status: %s\n", storage.StatusRepresentations[item.Status])
	fmt.Fprintf(&b, "link: %s\n", item.Link)
	fmt.Fprintf(&b, "instapaper_saved: %t\n\n", item.InstapaperSaved)
	b.WriteString(text)
	return textResult(b.String(), false)
}

func (s *Server) toolSetStatus(args json.RawMessage, status storage.ItemStatus, verb string) map[string]interface{} {
	id, ok := itemID(args)
	if !ok {
		return textResult("invalid arguments: 'id' (integer) is required", true)
	}
	if s.db.GetItem(id) == nil {
		return textResult(fmt.Sprintf("article %d not found", id), true)
	}
	s.db.UpdateItemStatus(id, status)
	return textResult(fmt.Sprintf("marked article %d as %s", id, verb), false)
}

func (s *Server) toolSaveToInstapaper(args json.RawMessage) map[string]interface{} {
	id, ok := itemID(args)
	if !ok {
		return textResult("invalid arguments: 'id' (integer) is required", true)
	}
	item := s.db.GetItem(id)
	if item == nil {
		return textResult(fmt.Sprintf("article %d not found", id), true)
	}
	username, _ := s.db.GetSettingsValue("instapaper_username").(string)
	password, _ := s.db.GetSettingsValue("instapaper_password").(string)
	if username == "" || password == "" {
		return textResult("Instapaper credentials not configured. Add your username and password in Settings.", true)
	}
	if err := InstapaperAdd(username, password, item.Link, item.Title); err != nil {
		return textResult("failed to save to Instapaper: "+err.Error(), true)
	}
	s.db.SetItemInstapaperSaved(id, true)
	s.db.UpdateItemStatus(id, storage.READ)
	return textResult(fmt.Sprintf("saved article %d to Instapaper", id), false)
}

func (s *Server) toolMarkAllRead(args json.RawMessage) map[string]interface{} {
	var a struct {
		FeedID   *int64 `json:"feed_id"`
		FolderID *int64 `json:"folder_id"`
	}
	if len(args) > 0 {
		if err := json.Unmarshal(args, &a); err != nil {
			return textResult("invalid arguments: "+err.Error(), true)
		}
	}
	s.db.MarkItemsRead(storage.MarkFilter{FeedID: a.FeedID, FolderID: a.FolderID})
	switch {
	case a.FeedID != nil:
		return textResult(fmt.Sprintf("marked all articles in feed %d as read", *a.FeedID), false)
	case a.FolderID != nil:
		return textResult(fmt.Sprintf("marked all articles in folder %d as read", *a.FolderID), false)
	default:
		return textResult("marked all articles as read", false)
	}
}

// --- library management tools ---

func (s *Server) folderExists(id int64) bool {
	for _, f := range s.db.ListFolders() {
		if f.Id == id {
			return true
		}
	}
	return false
}

func (s *Server) toolSubscribe(args json.RawMessage) map[string]interface{} {
	var a struct {
		URL      string `json:"url"`
		FolderID *int64 `json:"folder_id"`
	}
	if json.Unmarshal(args, &a) != nil || strings.TrimSpace(a.URL) == "" {
		return textResult("invalid arguments: 'url' (string) is required", true)
	}
	if a.FolderID != nil && !s.folderExists(*a.FolderID) {
		return textResult(fmt.Sprintf("folder %d not found", *a.FolderID), true)
	}

	result, err := worker.DiscoverFeed(a.URL)
	if err != nil {
		return textResult("could not find a feed at "+a.URL+": "+err.Error(), true)
	}
	if len(result.Sources) > 0 {
		var b strings.Builder
		fmt.Fprintf(&b, "%s exposes multiple feeds — call subscribe again with one of these URLs:\n", a.URL)
		for _, src := range result.Sources {
			fmt.Fprintf(&b, "- %s — %s\n", src.Title, src.Url)
		}
		return textResult(strings.TrimRight(b.String(), "\n"), false)
	}
	if result.Feed == nil {
		return textResult("no feed found at "+a.URL, true)
	}

	feed := s.db.CreateFeed(result.Feed.Title, "", result.Feed.SiteURL, result.FeedLink, a.FolderID)
	items := worker.ConvertItems(result.Feed.Items, *feed)
	if len(items) > 0 {
		s.db.CreateItems(items)
		s.db.SetFeedSize(feed.Id, len(items))
		s.db.SyncSearch()
	}
	s.worker.FindFeedFavicon(*feed)
	return textResult(fmt.Sprintf("subscribed to feed %d: %s (%s)", feed.Id, feed.Title, feed.FeedLink), false)
}

func (s *Server) toolUnsubscribe(args json.RawMessage) map[string]interface{} {
	var a struct {
		FeedID int64 `json:"feed_id"`
	}
	if json.Unmarshal(args, &a) != nil || a.FeedID == 0 {
		return textResult("invalid arguments: 'feed_id' (integer) is required", true)
	}
	feed := s.db.GetFeed(a.FeedID)
	if feed == nil {
		return textResult(fmt.Sprintf("feed %d not found", a.FeedID), true)
	}
	s.db.DeleteFeed(a.FeedID)
	return textResult(fmt.Sprintf("unsubscribed from feed %d: %s", a.FeedID, feed.Title), false)
}

func (s *Server) toolRenameFeed(args json.RawMessage) map[string]interface{} {
	var a struct {
		FeedID int64  `json:"feed_id"`
		Title  string `json:"title"`
	}
	if json.Unmarshal(args, &a) != nil || a.FeedID == 0 || strings.TrimSpace(a.Title) == "" {
		return textResult("invalid arguments: 'feed_id' (integer) and 'title' (non-empty string) are required", true)
	}
	if s.db.GetFeed(a.FeedID) == nil {
		return textResult(fmt.Sprintf("feed %d not found", a.FeedID), true)
	}
	s.db.RenameFeed(a.FeedID, a.Title)
	return textResult(fmt.Sprintf("renamed feed %d to %q", a.FeedID, a.Title), false)
}

func (s *Server) toolMoveFeed(args json.RawMessage) map[string]interface{} {
	var a struct {
		FeedID   int64  `json:"feed_id"`
		FolderID *int64 `json:"folder_id"`
	}
	if json.Unmarshal(args, &a) != nil || a.FeedID == 0 {
		return textResult("invalid arguments: 'feed_id' (integer) is required", true)
	}
	if s.db.GetFeed(a.FeedID) == nil {
		return textResult(fmt.Sprintf("feed %d not found", a.FeedID), true)
	}
	if a.FolderID != nil && !s.folderExists(*a.FolderID) {
		return textResult(fmt.Sprintf("folder %d not found", *a.FolderID), true)
	}
	s.db.UpdateFeedFolder(a.FeedID, a.FolderID)
	if a.FolderID != nil {
		return textResult(fmt.Sprintf("moved feed %d to folder %d", a.FeedID, *a.FolderID), false)
	}
	return textResult(fmt.Sprintf("removed feed %d from its folder", a.FeedID), false)
}

func (s *Server) toolCreateFolder(args json.RawMessage) map[string]interface{} {
	var a struct {
		Title string `json:"title"`
	}
	if json.Unmarshal(args, &a) != nil || strings.TrimSpace(a.Title) == "" {
		return textResult("invalid arguments: 'title' (non-empty string) is required", true)
	}
	folder := s.db.CreateFolder(a.Title)
	if folder == nil {
		return textResult("could not create folder (a folder with that title may already exist)", true)
	}
	return textResult(fmt.Sprintf("created folder %d: %s", folder.Id, folder.Title), false)
}

func (s *Server) toolRenameFolder(args json.RawMessage) map[string]interface{} {
	var a struct {
		FolderID int64  `json:"folder_id"`
		Title    string `json:"title"`
	}
	if json.Unmarshal(args, &a) != nil || a.FolderID == 0 || strings.TrimSpace(a.Title) == "" {
		return textResult("invalid arguments: 'folder_id' (integer) and 'title' (non-empty string) are required", true)
	}
	if !s.folderExists(a.FolderID) {
		return textResult(fmt.Sprintf("folder %d not found", a.FolderID), true)
	}
	s.db.RenameFolder(a.FolderID, a.Title)
	return textResult(fmt.Sprintf("renamed folder %d to %q", a.FolderID, a.Title), false)
}

func (s *Server) toolDeleteFolder(args json.RawMessage) map[string]interface{} {
	var a struct {
		FolderID int64 `json:"folder_id"`
	}
	if json.Unmarshal(args, &a) != nil || a.FolderID == 0 {
		return textResult("invalid arguments: 'folder_id' (integer) is required", true)
	}
	if !s.folderExists(a.FolderID) {
		return textResult(fmt.Sprintf("folder %d not found", a.FolderID), true)
	}
	s.db.DeleteFolder(a.FolderID)
	return textResult(fmt.Sprintf("deleted folder %d", a.FolderID), false)
}

func (s *Server) toolRefreshFeeds() map[string]interface{} {
	s.worker.RefreshFeeds()
	return textResult("started a background refresh of all feeds", false)
}

func (s *Server) toolListFeedErrors() map[string]interface{} {
	errors := s.db.GetFeedErrors()
	if len(errors) == 0 {
		return textResult("no feed errors", false)
	}
	titles := make(map[int64]string)
	for _, f := range s.db.ListFeeds() {
		titles[f.Id] = f.Title
	}
	var b strings.Builder
	for id, msg := range errors {
		fmt.Fprintf(&b, "[%d] %s — %s\n", id, titles[id], msg)
	}
	return textResult(strings.TrimRight(b.String(), "\n"), false)
}

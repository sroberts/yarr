package mcp

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/nkanaev/yarr/src/content/htmlutil"
	"github.com/nkanaev/yarr/src/content/sanitizer"
	"github.com/nkanaev/yarr/src/storage"
)

type toolFunc func(*storage.Storage, json.RawMessage) (*toolResult, *rpcError)

type tool struct {
	Name        string                 `json:"name"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Annotations map[string]interface{} `json:"annotations"`

	fn toolFunc
}

func findTool(name string) *tool {
	for i := range tools {
		if tools[i].Name == name {
			return &tools[i]
		}
	}
	return nil
}

func objectSchema(properties map[string]interface{}, required ...string) map[string]interface{} {
	schema := map[string]interface{}{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func readOnlyHints() map[string]interface{} {
	return map[string]interface{}{
		"readOnlyHint":    true,
		"idempotentHint":  true,
		"destructiveHint": false,
		"openWorldHint":   false,
	}
}

func writeHints(destructive bool) map[string]interface{} {
	return map[string]interface{}{
		"readOnlyHint":    false,
		"idempotentHint":  true,
		"destructiveHint": destructive,
		"openWorldHint":   false,
	}
}

var statusEnum = []string{"unread", "read", "starred"}

// tools is the whole protocol surface. The order is the order clients see.
var tools = []tool{
	{
		Name:  "list_feeds",
		Title: "List feeds",
		Description: "List every subscribed feed with its folder, unread and starred counts, and the last refresh error if it has one. " +
			"Takes no arguments. Use it to find the feed_id or folder_id that the other tools take.",
		InputSchema: objectSchema(map[string]interface{}{}),
		Annotations: readOnlyHints(),
		fn:          listFeeds,
	},
	{
		Name:  "list_items",
		Title: "Search articles",
		Description: "Search or browse articles. Returns metadata and a short snippet only; call get_item to read an article's body. " +
			"query matches article titles and text through the full-text index, which is filled as feeds are fetched, so very old articles may not be searchable. " +
			"Page through results by passing the next_cursor from a previous call as after_id.",
		InputSchema: objectSchema(map[string]interface{}{
			"query": map[string]interface{}{
				"type":        "string",
				"description": "Full-text search over article titles and text.",
			},
			"feed_id": map[string]interface{}{
				"type":        "integer",
				"description": "Limit to one feed, from list_feeds.",
			},
			"folder_id": map[string]interface{}{
				"type":        "integer",
				"description": "Limit to the feeds in one folder, from list_feeds.",
			},
			"status": map[string]interface{}{
				"type": "string",
				"enum": statusEnum,
				"description": "Limit to one status. The three statuses are exclusive rather than starred being an extra flag on a read or unread article, " +
					"so status \"unread\" does not include starred articles.",
			},
			"limit": map[string]interface{}{
				"type":        "integer",
				"minimum":     1,
				"maximum":     maxLimit,
				"description": "Articles to return, 1-50 (default 20).",
			},
			"oldest_first": map[string]interface{}{
				"type":        "boolean",
				"description": "Sort oldest first instead of newest first (default false).",
			},
			"after_id": map[string]interface{}{
				"type":        "integer",
				"description": "Continue after this article id, using next_cursor from a previous call.",
			},
		}),
		Annotations: readOnlyHints(),
		fn:          listItems,
	},
	{
		Name:  "get_item",
		Title: "Read an article",
		Description: "Read one article in full. The content is always sanitized; format \"text\" strips markup, format \"html\" keeps the sanitized markup. " +
			"Content longer than max_chars is cut short and reported as truncated.",
		InputSchema: objectSchema(map[string]interface{}{
			"id": map[string]interface{}{
				"type":        "integer",
				"description": "Article id, from list_items.",
			},
			"format": map[string]interface{}{
				"type":        "string",
				"enum":        []string{"text", "html"},
				"description": "Output format (default \"text\").",
			},
			"max_chars": map[string]interface{}{
				"type":        "integer",
				"minimum":     minMaxChars,
				"maximum":     maxMaxChars,
				"description": "Maximum characters of content to return (default 20000).",
			},
		}, "id"),
		Annotations: readOnlyHints(),
		fn:          getItem,
	},
	{
		Name:        "mark_item",
		Title:       "Change an article's status",
		Description: "Set one article's status. The three statuses are exclusive: marking an article read clears a star, and starring it takes it out of unread.",
		InputSchema: objectSchema(map[string]interface{}{
			"id": map[string]interface{}{
				"type":        "integer",
				"description": "Article id, from list_items.",
			},
			"status": map[string]interface{}{
				"type":        "string",
				"enum":        statusEnum,
				"description": "The status to set.",
			},
		}, "id", "status"),
		Annotations: writeHints(false),
		fn:          markItem,
	},
	{
		Name:  "mark_all_read",
		Title: "Mark articles read in bulk",
		Description: "Mark many articles read at once. Starred articles are never touched. " +
			"Requires feed_id, folder_id or before; marking the entire database read needs all set to true.",
		InputSchema: objectSchema(map[string]interface{}{
			"feed_id": map[string]interface{}{
				"type":        "integer",
				"description": "Limit to one feed, from list_feeds.",
			},
			"folder_id": map[string]interface{}{
				"type":        "integer",
				"description": "Limit to the feeds in one folder, from list_feeds.",
			},
			"before": map[string]interface{}{
				"type":        "string",
				"description": "Only articles published before this RFC3339 timestamp.",
			},
			"all": map[string]interface{}{
				"type":        "boolean",
				"description": "Mark everything read when no other filter is given (default false).",
			},
		}),
		Annotations: writeHints(true),
		fn:          markAllRead,
	},
}

// decodeArgs turns tool arguments into v. A malformed argument object is a
// problem with the shape of the call, so it comes back as a protocol error
// rather than a tool failure.
func decodeArgs(args json.RawMessage, v interface{}) *rpcError {
	if err := json.Unmarshal(args, v); err != nil {
		return &rpcError{Code: codeInvalidParams, Message: "Invalid arguments: " + err.Error()}
	}
	return nil
}

func invalidParams(format string, args ...interface{}) *rpcError {
	return &rpcError{Code: codeInvalidParams, Message: fmt.Sprintf(format, args...)}
}

type folderInfo struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

type feedInfo struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	FolderID    *int64 `json:"folder_id"`
	FolderTitle string `json:"folder_title"`
	SiteURL     string `json:"site_url"`
	FeedURL     string `json:"feed_url"`
	Unread      int64  `json:"unread"`
	Starred     int64  `json:"starred"`
	Error       string `json:"error"`
}

func listFeeds(db *storage.Storage, args json.RawMessage) (*toolResult, *rpcError) {
	folders := db.ListFolders()
	feeds := db.ListFeeds()
	stats := db.FeedStats()
	feedErrors := db.GetFeedErrors()

	folderTitles := make(map[int64]string, len(folders))
	outFolders := make([]folderInfo, 0, len(folders))
	for _, f := range folders {
		folderTitles[f.Id] = f.Title
		outFolders = append(outFolders, folderInfo{ID: f.Id, Title: f.Title})
	}

	statsByFeed := make(map[int64]storage.FeedStat, len(stats))
	var totalUnread, totalStarred int64
	for _, s := range stats {
		statsByFeed[s.FeedId] = s
		totalUnread += s.UnreadCount
		totalStarred += s.StarredCount
	}

	outFeeds := make([]feedInfo, 0, len(feeds))
	for _, f := range feeds {
		info := feedInfo{
			ID:       f.Id,
			Title:    f.Title,
			FolderID: f.FolderId,
			SiteURL:  f.Link,
			FeedURL:  f.FeedLink,
			Unread:   statsByFeed[f.Id].UnreadCount,
			Starred:  statsByFeed[f.Id].StarredCount,
			Error:    feedErrors[f.Id],
		}
		if f.FolderId != nil {
			info.FolderTitle = folderTitles[*f.FolderId]
		}
		outFeeds = append(outFeeds, info)
	}

	structured := map[string]interface{}{
		"folders": outFolders,
		"feeds":   outFeeds,
		"totals": map[string]interface{}{
			"unread":  totalUnread,
			"starred": totalStarred,
		},
	}
	return okResult(renderFeeds(outFolders, outFeeds, totalUnread, totalStarred), structured), nil
}

type itemInfo struct {
	ID        int64     `json:"id"`
	FeedID    int64     `json:"feed_id"`
	FeedTitle string    `json:"feed_title"`
	Title     string    `json:"title"`
	Link      string    `json:"link"`
	Date      time.Time `json:"date"`
	Status    string    `json:"status"`
	Snippet   string    `json:"snippet"`
}

type listItemsArgs struct {
	Query       *string `json:"query"`
	FeedID      *int64  `json:"feed_id"`
	FolderID    *int64  `json:"folder_id"`
	Status      *string `json:"status"`
	Limit       *int    `json:"limit"`
	OldestFirst bool    `json:"oldest_first"`
	AfterID     *int64  `json:"after_id"`
}

func listItems(db *storage.Storage, args json.RawMessage) (*toolResult, *rpcError) {
	var a listItemsArgs
	if err := decodeArgs(args, &a); err != nil {
		return nil, err
	}

	filter := storage.ItemFilter{
		FeedID:   a.FeedID,
		FolderID: a.FolderID,
		After:    a.AfterID,
	}
	if a.Status != nil {
		status, ok := storage.StatusValues[*a.Status]
		if !ok {
			return nil, invalidParams("Invalid status %q: expected unread, read or starred.", *a.Status)
		}
		filter.Status = &status
	}
	if a.Query != nil && *a.Query != "" {
		query := sanitizeSearchQuery(*a.Query)
		if query == "" {
			return errResult("The query %q has no searchable words in it.", *a.Query), nil
		}
		filter.Search = &query
	}

	limit := clampLimit(a.Limit)
	newestFirst := !a.OldestFirst

	// One extra row answers "is there another page" without a second query.
	items := db.ListItems(filter, limit+1, newestFirst, true)
	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}

	countFilter := filter
	countFilter.After = nil
	total := db.CountItems(countFilter)

	feedTitles := make(map[int64]string)
	for _, f := range db.ListFeeds() {
		feedTitles[f.Id] = f.Title
	}

	// Article bodies never travel through this tool; the snippet is the whole
	// preview, and get_item is how a model reads more.
	out := make([]itemInfo, 0, len(items))
	for _, it := range items {
		out = append(out, itemInfo{
			ID:        it.Id,
			FeedID:    it.FeedId,
			FeedTitle: feedTitles[it.FeedId],
			Title:     itemTitle(it.Title, it.Link, it.Content),
			Link:      it.Link,
			Date:      it.Date,
			Status:    storage.StatusRepresentations[it.Status],
			Snippet:   snippet(it.Link, it.Content),
		})
	}

	var nextCursor *int64
	if len(out) > 0 {
		last := out[len(out)-1].ID
		nextCursor = &last
	}

	structured := map[string]interface{}{
		"items":       out,
		"total":       total,
		"has_more":    hasMore,
		"next_cursor": nextCursor,
	}
	return okResult(renderItems(out, total, hasMore, nextCursor), structured), nil
}

type articleInfo struct {
	ID        int64     `json:"id"`
	FeedID    int64     `json:"feed_id"`
	FeedTitle string    `json:"feed_title"`
	Title     string    `json:"title"`
	Link      string    `json:"link"`
	Date      time.Time `json:"date"`
	Status    string    `json:"status"`
	Format    string    `json:"format"`
	Content   string    `json:"content"`
	Truncated bool      `json:"truncated"`
}

type getItemArgs struct {
	ID       *int64  `json:"id"`
	Format   *string `json:"format"`
	MaxChars *int    `json:"max_chars"`
}

func getItem(db *storage.Storage, args json.RawMessage) (*toolResult, *rpcError) {
	var a getItemArgs
	if err := decodeArgs(args, &a); err != nil {
		return nil, err
	}
	if a.ID == nil {
		return nil, invalidParams("Missing required argument: id.")
	}
	format := "text"
	if a.Format != nil {
		if *a.Format != "text" && *a.Format != "html" {
			return nil, invalidParams("Invalid format %q: expected text or html.", *a.Format)
		}
		format = *a.Format
	}
	maxChars := clampMaxChars(a.MaxChars)

	item := db.GetItem(*a.ID)
	if item == nil {
		return errResult("No article with id %d.", *a.ID), nil
	}

	feedTitle := ""
	if feed := db.GetFeed(item.FeedId); feed != nil {
		feedTitle = feed.Title
	}

	// Sanitize first in both formats: the text extraction below runs over
	// markup that has already had scripts and the like removed.
	content := sanitizer.Sanitize(item.Link, item.Content)
	if format == "text" {
		content = htmlutil.ExtractText(content)
	}
	content, truncated := truncateChars(content, maxChars)

	info := itemInfo{
		ID:        item.Id,
		FeedID:    item.FeedId,
		FeedTitle: feedTitle,
		Title:     itemTitle(item.Title, item.Link, item.Content),
		Link:      item.Link,
		Date:      item.Date,
		Status:    storage.StatusRepresentations[item.Status],
	}
	structured := articleInfo{
		ID:        info.ID,
		FeedID:    info.FeedID,
		FeedTitle: info.FeedTitle,
		Title:     info.Title,
		Link:      info.Link,
		Date:      info.Date,
		Status:    info.Status,
		Format:    format,
		Content:   content,
		Truncated: truncated,
	}
	return okResult(renderItem(info, content, truncated, maxChars), structured), nil
}

type markItemArgs struct {
	ID     *int64  `json:"id"`
	Status *string `json:"status"`
}

func markItem(db *storage.Storage, args json.RawMessage) (*toolResult, *rpcError) {
	var a markItemArgs
	if err := decodeArgs(args, &a); err != nil {
		return nil, err
	}
	if a.ID == nil {
		return nil, invalidParams("Missing required argument: id.")
	}
	if a.Status == nil {
		return nil, invalidParams("Missing required argument: status.")
	}
	status, ok := storage.StatusValues[*a.Status]
	if !ok {
		return nil, invalidParams("Invalid status %q: expected unread, read or starred.", *a.Status)
	}

	item := db.GetItem(*a.ID)
	if item == nil {
		return errResult("No article with id %d.", *a.ID), nil
	}
	previous := storage.StatusRepresentations[item.Status]
	if !db.UpdateItemStatus(*a.ID, status) {
		return errResult("Failed to update article %d.", *a.ID), nil
	}

	structured := map[string]interface{}{
		"id":              *a.ID,
		"status":          *a.Status,
		"previous_status": previous,
	}
	return okResult(fmt.Sprintf("Article %d: %s -> %s.", *a.ID, previous, *a.Status), structured), nil
}

type markAllReadArgs struct {
	FeedID   *int64  `json:"feed_id"`
	FolderID *int64  `json:"folder_id"`
	Before   *string `json:"before"`
	All      bool    `json:"all"`
}

func markAllRead(db *storage.Storage, args json.RawMessage) (*toolResult, *rpcError) {
	var a markAllReadArgs
	if err := decodeArgs(args, &a); err != nil {
		return nil, err
	}

	var before *time.Time
	if a.Before != nil && *a.Before != "" {
		t, err := time.Parse(time.RFC3339, *a.Before)
		if err != nil {
			return nil, invalidParams("Invalid before %q: expected an RFC3339 timestamp such as 2026-01-31T00:00:00Z.", *a.Before)
		}
		t = t.UTC()
		before = &t
	}

	if a.FeedID == nil && a.FolderID == nil && before == nil && !a.All {
		return errResult("Refusing to mark everything read: pass feed_id, folder_id, or before, or set all:true."), nil
	}

	// Counted before the update, because afterwards the rows are
	// indistinguishable from articles that were already read.
	unread := storage.UNREAD
	marked := db.CountItems(storage.ItemFilter{
		FolderID: a.FolderID,
		FeedID:   a.FeedID,
		Before:   before,
		Status:   &unread,
	})

	if !db.MarkItemsRead(storage.MarkFilter{
		FolderID: a.FolderID,
		FeedID:   a.FeedID,
		Before:   before,
	}) {
		return errResult("Failed to mark articles read."), nil
	}

	return okResult(
		fmt.Sprintf("Marked %d article(s) read. Starred articles were left alone.", marked),
		map[string]interface{}{"marked_read": marked},
	), nil
}

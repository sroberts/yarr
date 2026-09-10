package mcp

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nkanaev/yarr/src/storage"
)

type callResult struct {
	Content    []textContent
	Structured json.RawMessage
	IsError    bool
}

func (r callResult) text() string {
	parts := make([]string, 0, len(r.Content))
	for _, c := range r.Content {
		parts = append(parts, c.Text)
	}
	return strings.Join(parts, "\n")
}

func (r callResult) decode(t *testing.T, v interface{}) {
	t.Helper()
	if len(r.Structured) == 0 {
		t.Fatal("no structuredContent in result")
	}
	if err := json.Unmarshal(r.Structured, v); err != nil {
		t.Fatalf("structuredContent: %v", err)
	}
}

func callTool(t *testing.T, h http.Handler, name, args string) (rpcResponse, callResult) {
	t.Helper()
	if args == "" {
		args = "{}"
	}
	_, resp := post(t, h, fmt.Sprintf(
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":%q,"arguments":%s}}`, name, args))

	var out callResult
	if raw, ok := resp.Result["content"]; ok {
		if err := json.Unmarshal(raw, &out.Content); err != nil {
			t.Fatalf("content: %v", err)
		}
	}
	out.Structured = resp.Result["structuredContent"]
	if raw, ok := resp.Result["isError"]; ok {
		if err := json.Unmarshal(raw, &out.IsError); err != nil {
			t.Fatalf("isError: %v", err)
		}
	}
	return resp, out
}

// mustCall fails on a protocol error, which no well-formed tool call should
// ever produce.
func mustCall(t *testing.T, h http.Handler, name, args string) callResult {
	t.Helper()
	resp, out := callTool(t, h, name, args)
	if resp.Error != nil {
		t.Fatalf("%s: unexpected JSON-RPC error: %+v", name, resp.Error)
	}
	return out
}

type fixture struct {
	db     *storage.Storage
	h      http.Handler
	folder int64
	feedA  int64
	feedB  int64
	ids    map[string]int64
}

const longBody = "Details of the incident follow. "

func newFixture(t *testing.T) *fixture {
	t.Helper()

	log.SetOutput(io.Discard)
	db, err := storage.New(":memory:")
	log.SetOutput(os.Stderr)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	folder := db.CreateFolder("Security")
	feedA := db.CreateFeed("Krebs on Security", "", "https://krebsonsecurity.com", "https://krebsonsecurity.com/feed", &folder.Id)
	feedB := db.CreateFeed("Daring Fireball", "", "https://daringfireball.net", "https://daringfireball.net/feed.json", nil)

	day := func(d int) time.Time { return time.Date(2026, 9, d, 12, 0, 0, 0, time.UTC) }

	db.CreateItems([]storage.Item{
		{
			GUID: "breach", FeedId: feedA.Id, Date: day(5),
			Title:   "Breach at Example Corp",
			Link:    "https://example.com/breach",
			Content: `<p>Attackers stole data.</p><script>alert("xss")</script><p>` + strings.Repeat(longBody, 40) + `</p>`,
		},
		{
			GUID: "quote", FeedId: feedA.Id, Date: day(4),
			Title:   `He said "hi" to the room`,
			Link:    "https://example.com/quote",
			Content: `<p>he said "hi" and then left the room</p>`,
		},
		{
			GUID: "advisory", FeedId: feedA.Id, Date: day(3),
			Title:   "Old advisory",
			Link:    "https://example.com/advisory",
			Content: `<p>Patch your things.</p>`,
		},
		{
			GUID: "writeup", FeedId: feedA.Id, Date: day(2),
			Title:   "Starred writeup",
			Link:    "https://example.com/writeup",
			Content: `<p>Worth keeping.</p>`,
		},
		{
			GUID: "fireball", FeedId: feedB.Id, Date: day(1),
			Title:   "Fireball post",
			Link:    "https://daringfireball.net/post",
			Content: `<p>A short note.</p>`,
		},
		{
			GUID: "untitled", FeedId: feedB.Id, Date: day(1).Add(-time.Hour),
			Link:    "https://daringfireball.net/untitled",
			Content: `<p>An untitled note about widgets.</p>`,
		},
	})

	ids := make(map[string]int64)
	for _, item := range db.ListItems(storage.ItemFilter{}, 100, true, false) {
		ids[item.GUID] = item.Id
	}
	db.UpdateItemStatus(ids["advisory"], storage.READ)
	db.UpdateItemStatus(ids["writeup"], storage.STARRED)

	// Without this the search index is empty and every query matches nothing.
	db.SyncSearch()

	return &fixture{
		db:     db,
		h:      newTestHandler(db),
		folder: folder.Id,
		feedA:  feedA.Id,
		feedB:  feedB.Id,
		ids:    ids,
	}
}

func TestListFeeds(t *testing.T) {
	f := newFixture(t)
	res := mustCall(t, f.h, "list_feeds", "")
	if res.IsError {
		t.Fatalf("unexpected tool error: %s", res.text())
	}

	var got struct {
		Folders []folderInfo `json:"folders"`
		Feeds   []feedInfo   `json:"feeds"`
		Totals  struct {
			Unread  int64 `json:"unread"`
			Starred int64 `json:"starred"`
		} `json:"totals"`
	}
	res.decode(t, &got)

	if len(got.Folders) != 1 || got.Folders[0].Title != "Security" {
		t.Fatalf("folders = %+v", got.Folders)
	}
	if len(got.Feeds) != 2 {
		t.Fatalf("feeds = %+v", got.Feeds)
	}
	byID := map[int64]feedInfo{}
	for _, feed := range got.Feeds {
		byID[feed.ID] = feed
	}
	a, b := byID[f.feedA], byID[f.feedB]
	if a.FolderID == nil || *a.FolderID != f.folder || a.FolderTitle != "Security" {
		t.Fatalf("feed A folder = %+v", a)
	}
	if b.FolderID != nil {
		t.Fatalf("a feed outside every folder must report folder_id null, got %v", *b.FolderID)
	}
	if a.Unread != 2 || a.Starred != 1 {
		t.Fatalf("feed A counts: unread=%d starred=%d, want 2/1", a.Unread, a.Starred)
	}
	if b.Unread != 2 {
		t.Fatalf("feed B unread = %d, want 2", b.Unread)
	}
	if got.Totals.Unread != 4 || got.Totals.Starred != 1 {
		t.Fatalf("totals = %+v", got.Totals)
	}
	if !strings.Contains(res.text(), "Krebs on Security") {
		t.Fatalf("text does not name the feeds:\n%s", res.text())
	}
}

type listItemsResult struct {
	Items      []itemInfo `json:"items"`
	Total      int        `json:"total"`
	HasMore    bool       `json:"has_more"`
	NextCursor *int64     `json:"next_cursor"`
}

func TestListItems(t *testing.T) {
	f := newFixture(t)
	res := mustCall(t, f.h, "list_items", "{}")

	var got listItemsResult
	res.decode(t, &got)
	if got.Total != 6 {
		t.Fatalf("total = %d, want 6", got.Total)
	}
	if len(got.Items) != 6 || got.HasMore {
		t.Fatalf("items = %d, has_more = %v", len(got.Items), got.HasMore)
	}
	if got.Items[0].Title != "Breach at Example Corp" || got.Items[0].FeedTitle != "Krebs on Security" {
		t.Fatalf("first item = %+v", got.Items[0])
	}
	if got.Items[0].Status != "unread" {
		t.Fatalf("status = %q", got.Items[0].Status)
	}

	// An untitled article borrows the opening of its text, like the web UI.
	last := got.Items[len(got.Items)-1]
	if !strings.Contains(last.Title, "untitled note") {
		t.Fatalf("empty title was not filled in: %+v", last)
	}

	// Bodies never travel through list_items, and snippets stay short.
	var raw []map[string]json.RawMessage
	if err := json.Unmarshal(mustField(t, res.Structured, "items"), &raw); err != nil {
		t.Fatal(err)
	}
	for _, item := range raw {
		if _, ok := item["content"]; ok {
			t.Fatal("list_items must not return article bodies")
		}
	}
	for _, item := range got.Items {
		if len([]rune(item.Snippet)) > snippetChars+4 {
			t.Fatalf("snippet is %d chars long", len([]rune(item.Snippet)))
		}
		if strings.Contains(item.Snippet, "alert(") {
			t.Fatalf("snippet carries script source: %q", item.Snippet)
		}
	}
	if !strings.Contains(res.text(), "Showing 6 of 6 matches.") {
		t.Fatalf("missing trailer:\n%s", res.text())
	}
}

func mustField(t *testing.T, raw json.RawMessage, key string) json.RawMessage {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m[key]
}

func TestListItemsFilters(t *testing.T) {
	f := newFixture(t)

	feedOnly := mustCall(t, f.h, "list_items", fmt.Sprintf(`{"feed_id":%d}`, f.feedB))
	var got listItemsResult
	feedOnly.decode(t, &got)
	if got.Total != 2 || len(got.Items) != 2 {
		t.Fatalf("feed filter: total=%d items=%d, want 2/2", got.Total, len(got.Items))
	}

	folderOnly := mustCall(t, f.h, "list_items", fmt.Sprintf(`{"folder_id":%d}`, f.folder))
	folderOnly.decode(t, &got)
	if got.Total != 4 {
		t.Fatalf("folder filter: total=%d, want 4", got.Total)
	}

	starred := mustCall(t, f.h, "list_items", `{"status":"starred"}`)
	starred.decode(t, &got)
	if len(got.Items) != 1 || got.Items[0].Title != "Starred writeup" {
		t.Fatalf("starred filter = %+v", got.Items)
	}

	oldest := mustCall(t, f.h, "list_items", `{"oldest_first":true,"limit":1}`)
	oldest.decode(t, &got)
	if len(got.Items) != 1 || !strings.Contains(got.Items[0].Title, "untitled note") {
		t.Fatalf("oldest_first = %+v", got.Items)
	}

	// A negative limit would reach storage as "limit -1", which SQLite reads
	// as no limit at all.
	clamped := mustCall(t, f.h, "list_items", `{"limit":-5}`)
	clamped.decode(t, &got)
	if len(got.Items) != 1 {
		t.Fatalf("a negative limit must clamp to one row, got %d", len(got.Items))
	}

	resp, _ := callTool(t, f.h, "list_items", `{"status":"important"}`)
	if resp.Error == nil || resp.Error.Code != codeInvalidParams {
		t.Fatalf("a bad status enum must be -32602, got %+v", resp.Error)
	}
	resp, _ = callTool(t, f.h, "list_items", `{"limit":"twenty"}`)
	if resp.Error == nil || resp.Error.Code != codeInvalidParams {
		t.Fatalf("a wrongly typed argument must be -32602, got %+v", resp.Error)
	}
}

func TestListItemsCursorChaining(t *testing.T) {
	f := newFixture(t)

	var page listItemsResult
	mustCall(t, f.h, "list_items", `{"limit":2}`).decode(t, &page)
	if len(page.Items) != 2 || !page.HasMore || page.NextCursor == nil {
		t.Fatalf("first page = %+v", page)
	}
	first := []int64{page.Items[0].ID, page.Items[1].ID}
	cursor := *page.NextCursor
	if cursor != first[1] {
		t.Fatalf("next_cursor = %d, want the last returned id %d", cursor, first[1])
	}
	if !strings.Contains(mustCall(t, f.h, "list_items", `{"limit":2}`).text(), fmt.Sprintf("next_cursor: %d", cursor)) {
		t.Fatal("the rendered trailer should carry the cursor")
	}

	var next listItemsResult
	mustCall(t, f.h, "list_items", fmt.Sprintf(`{"limit":2,"after_id":%d}`, cursor)).decode(t, &next)
	if len(next.Items) != 2 {
		t.Fatalf("second page = %+v", next.Items)
	}
	for _, item := range next.Items {
		if item.ID == first[0] || item.ID == first[1] {
			t.Fatalf("item %d appeared on both pages", item.ID)
		}
	}
	// total counts matches, not the remainder of the page walk.
	if next.Total != 6 {
		t.Fatalf("total = %d, want 6", next.Total)
	}
}

// A phrase with ordinary punctuation in it must still search. storage turns
// every whitespace-separated word into an FTS4 prefix term, so a stray bracket
// or an unbalanced quote - the way a person actually quotes a phrase - reaches
// SQLite as a malformed match expression, which fails and silently returns
// nothing at all. The unbalanced cases below are the ones that regress.
func TestListItemsPunctuationQuery(t *testing.T) {
	f := newFixture(t)
	for _, query := range []string{`he said "hi"`, `he said "hi`, `room)`, `hi (room)`, `room -- said`, `said:`} {
		var got listItemsResult
		mustCall(t, f.h, "list_items", fmt.Sprintf(`{"query":%q}`, query)).decode(t, &got)
		if len(got.Items) == 0 {
			t.Fatalf("query %q returned nothing", query)
		}
		if got.Items[0].ID != f.ids["quote"] {
			t.Fatalf("query %q matched %+v", query, got.Items[0])
		}
	}

	var empty listItemsResult
	res := mustCall(t, f.h, "list_items", `{"query":"zzzznothing"}`)
	res.decode(t, &empty)
	if len(empty.Items) != 0 || empty.Total != 0 {
		t.Fatalf("expected no matches, got %+v", empty)
	}

	// A query made only of operator characters has nothing left to search for.
	if got := mustCall(t, f.h, "list_items", `{"query":"***"}`); !got.IsError {
		t.Fatalf("expected a tool error, got %s", got.text())
	}
}

type articleResult struct {
	ID        int64  `json:"id"`
	FeedTitle string `json:"feed_title"`
	Title     string `json:"title"`
	Status    string `json:"status"`
	Format    string `json:"format"`
	Content   string `json:"content"`
	Truncated bool   `json:"truncated"`
}

func TestGetItem(t *testing.T) {
	f := newFixture(t)
	id := f.ids["breach"]

	var text articleResult
	res := mustCall(t, f.h, "get_item", fmt.Sprintf(`{"id":%d}`, id))
	res.decode(t, &text)
	if text.ID != id || text.FeedTitle != "Krebs on Security" || text.Format != "text" {
		t.Fatalf("article = %+v", text)
	}
	if strings.Contains(text.Content, "<p>") {
		t.Fatalf("text format must not contain markup:\n%s", text.Content)
	}
	if !strings.Contains(text.Content, "Attackers stole data.") {
		t.Fatalf("text format lost the article:\n%s", text.Content)
	}
	if !strings.Contains(res.text(), "Attackers stole data.") {
		t.Fatal("the rendered text should carry the article")
	}

	var html articleResult
	mustCall(t, f.h, "get_item", fmt.Sprintf(`{"id":%d,"format":"html"}`, id)).decode(t, &html)
	if !strings.Contains(html.Content, "<p>") {
		t.Fatalf("html format lost its markup:\n%s", html.Content)
	}

	// Both formats run through the sanitizer first.
	for name, content := range map[string]string{"text": text.Content, "html": html.Content} {
		if strings.Contains(content, "<script") || strings.Contains(content, "alert(") {
			t.Fatalf("%s format leaked a script:\n%s", name, content)
		}
	}

	resp, _ := callTool(t, f.h, "get_item", fmt.Sprintf(`{"id":%d,"format":"markdown"}`, id))
	if resp.Error == nil || resp.Error.Code != codeInvalidParams {
		t.Fatalf("a bad format enum must be -32602, got %+v", resp.Error)
	}
	resp, _ = callTool(t, f.h, "get_item", `{}`)
	if resp.Error == nil || resp.Error.Code != codeInvalidParams {
		t.Fatalf("a missing id must be -32602, got %+v", resp.Error)
	}
}

func TestGetItemTruncates(t *testing.T) {
	f := newFixture(t)

	var got articleResult
	res := mustCall(t, f.h, "get_item", fmt.Sprintf(`{"id":%d,"max_chars":500}`, f.ids["breach"]))
	res.decode(t, &got)
	if !got.Truncated {
		t.Fatal("expected truncated:true")
	}
	if n := len([]rune(got.Content)); n != 500 {
		t.Fatalf("content is %d chars, want 500", n)
	}
	if !strings.Contains(res.text(), "truncated at 500 characters") {
		t.Fatalf("the reader should be told it was cut short:\n%s", res.text())
	}

	var short articleResult
	mustCall(t, f.h, "get_item", fmt.Sprintf(`{"id":%d}`, f.ids["fireball"])).decode(t, &short)
	if short.Truncated {
		t.Fatal("a short article must not report truncation")
	}
}

// A tool that fails is still a successful JSON-RPC call: the model has to see
// the failure and be able to act on it, which it cannot do with a protocol
// error.
func TestGetItemUnknownIDIsToolError(t *testing.T) {
	f := newFixture(t)
	resp, res := callTool(t, f.h, "get_item", `{"id":999}`)

	if resp.Error != nil {
		t.Fatalf("a missing article must not be a JSON-RPC error: %+v", resp.Error)
	}
	if !res.IsError {
		t.Fatal("expected isError:true")
	}
	if len(res.Structured) != 0 {
		t.Fatalf("a failed tool call must not carry structuredContent: %s", res.Structured)
	}
	if !strings.Contains(res.text(), "No article with id 999.") {
		t.Fatalf("text = %q", res.text())
	}
}

func TestMarkItem(t *testing.T) {
	f := newFixture(t)
	id := f.ids["breach"]

	var got struct {
		ID             int64  `json:"id"`
		Status         string `json:"status"`
		PreviousStatus string `json:"previous_status"`
	}
	mustCall(t, f.h, "mark_item", fmt.Sprintf(`{"id":%d,"status":"read"}`, id)).decode(t, &got)
	if got.ID != id || got.Status != "read" || got.PreviousStatus != "unread" {
		t.Fatalf("result = %+v", got)
	}
	if item := f.db.GetItem(id); item.Status != storage.READ {
		t.Fatalf("stored status = %v, want read", item.Status)
	}

	mustCall(t, f.h, "mark_item", fmt.Sprintf(`{"id":%d,"status":"starred"}`, id)).decode(t, &got)
	if got.PreviousStatus != "read" {
		t.Fatalf("previous_status = %q, want read", got.PreviousStatus)
	}
	if item := f.db.GetItem(id); item.Status != storage.STARRED {
		t.Fatalf("stored status = %v, want starred", item.Status)
	}

	// A missing article is the model's problem to solve, not a bad call.
	resp, res := callTool(t, f.h, "mark_item", `{"id":999,"status":"read"}`)
	if resp.Error != nil || !res.IsError {
		t.Fatalf("expected a tool error, got error=%+v isError=%v", resp.Error, res.IsError)
	}

	// A status outside the enum is a malformed call.
	for _, args := range []string{
		fmt.Sprintf(`{"id":%d,"status":"skimmed"}`, id),
		fmt.Sprintf(`{"id":%d}`, id),
		`{"status":"read"}`,
	} {
		resp, _ := callTool(t, f.h, "mark_item", args)
		if resp.Error == nil || resp.Error.Code != codeInvalidParams {
			t.Fatalf("%s: expected -32602, got %+v", args, resp.Error)
		}
	}
}

func TestMarkAllRead(t *testing.T) {
	f := newFixture(t)

	var got struct {
		MarkedRead int `json:"marked_read"`
	}
	mustCall(t, f.h, "mark_all_read", fmt.Sprintf(`{"feed_id":%d}`, f.feedA)).decode(t, &got)
	if got.MarkedRead != 2 {
		t.Fatalf("marked_read = %d, want 2", got.MarkedRead)
	}

	if item := f.db.GetItem(f.ids["writeup"]); item.Status != storage.STARRED {
		t.Fatalf("a starred article must survive mark_all_read, got %v", item.Status)
	}
	for _, guid := range []string{"breach", "quote", "advisory"} {
		if item := f.db.GetItem(f.ids[guid]); item.Status != storage.READ {
			t.Fatalf("%s: status = %v, want read", guid, item.Status)
		}
	}
	if item := f.db.GetItem(f.ids["fireball"]); item.Status != storage.UNREAD {
		t.Fatalf("another feed was touched: %v", item.Status)
	}

	// Nothing left unread in that feed, so a second pass marks nothing.
	mustCall(t, f.h, "mark_all_read", fmt.Sprintf(`{"feed_id":%d}`, f.feedA)).decode(t, &got)
	if got.MarkedRead != 0 {
		t.Fatalf("marked_read = %d, want 0", got.MarkedRead)
	}

	mustCall(t, f.h, "mark_all_read", `{"all":true}`).decode(t, &got)
	if got.MarkedRead != 2 {
		t.Fatalf("marked_read = %d, want the 2 remaining unread articles", got.MarkedRead)
	}
}

func TestMarkAllReadRequiresAFilter(t *testing.T) {
	f := newFixture(t)

	resp, res := callTool(t, f.h, "mark_all_read", `{}`)
	if resp.Error != nil {
		t.Fatalf("unexpected JSON-RPC error: %+v", resp.Error)
	}
	if !res.IsError {
		t.Fatal("marking the whole database read must not happen by accident")
	}
	if !strings.Contains(res.text(), "Refusing to mark everything read") {
		t.Fatalf("text = %q", res.text())
	}

	for _, guid := range []string{"breach", "quote", "fireball", "untitled"} {
		if item := f.db.GetItem(f.ids[guid]); item.Status != storage.UNREAD {
			t.Fatalf("%s changed status to %v", guid, item.Status)
		}
	}

	resp, _ = callTool(t, f.h, "mark_all_read", `{"before":"yesterday"}`)
	if resp.Error == nil || resp.Error.Code != codeInvalidParams {
		t.Fatalf("a malformed timestamp must be -32602, got %+v", resp.Error)
	}
}

func TestMarkAllReadBefore(t *testing.T) {
	f := newFixture(t)

	var got struct {
		MarkedRead int `json:"marked_read"`
	}
	mustCall(t, f.h, "mark_all_read", `{"before":"2026-09-03T00:00:00Z"}`).decode(t, &got)
	if got.MarkedRead != 2 {
		t.Fatalf("marked_read = %d, want the 2 unread articles older than the cutoff", got.MarkedRead)
	}
	if item := f.db.GetItem(f.ids["breach"]); item.Status != storage.UNREAD {
		t.Fatalf("a newer article was marked read: %v", item.Status)
	}
}

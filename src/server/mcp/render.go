package mcp

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nkanaev/yarr/src/content/htmlutil"
	"github.com/nkanaev/yarr/src/content/sanitizer"
)

const (
	defaultLimit = 20
	maxLimit     = 50

	defaultMaxChars = 20000
	minMaxChars     = 500
	maxMaxChars     = 200000

	snippetChars = 280
	titleChars   = 140

	dateLayout = "2006-01-02"
)

// maxResultBytes is a backstop, not a budget. Every tool already bounds its own
// output - list_items never returns article bodies and caps its page at
// maxLimit, get_item caps at max_chars - so this exists only so that a future
// change cannot quietly hand a model a megabyte of text.
const maxResultBytes = 1 << 20

type textContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type toolResult struct {
	Content    []textContent `json:"content"`
	Structured interface{}   `json:"structuredContent,omitempty"`
	IsError    bool          `json:"isError"`
}

func okResult(text string, structured interface{}) *toolResult {
	return &toolResult{
		Content:    []textContent{{Type: "text", Text: text}},
		Structured: structured,
	}
}

// errResult reports a failure the model should see and can act on - a missing
// article, a refused bulk update - as opposed to a malformed call, which is a
// JSON-RPC error instead.
func errResult(format string, args ...interface{}) *toolResult {
	return &toolResult{
		Content: []textContent{{Type: "text", Text: fmt.Sprintf(format, args...)}},
		IsError: true,
	}
}

func capResult(r *toolResult) *toolResult {
	body, err := json.Marshal(r)
	if err != nil || len(body) <= maxResultBytes {
		// A marshal failure is reported as an internal error further up, when
		// the response itself fails to encode.
		return r
	}
	return errResult("Result too large to return (%d bytes). Retry with a smaller limit or max_chars.", len(body))
}

// clampLimit keeps a page size inside [1,maxLimit]. This is load-bearing:
// storage.ListItems interpolates the limit into its SQL with %d, so a negative
// value becomes "limit -1", which SQLite reads as no limit at all.
func clampLimit(v *int) int {
	if v == nil {
		return defaultLimit
	}
	switch {
	case *v < 1:
		return 1
	case *v > maxLimit:
		return maxLimit
	}
	return *v
}

func clampMaxChars(v *int) int {
	if v == nil {
		return defaultMaxChars
	}
	switch {
	case *v < minMaxChars:
		return minMaxChars
	case *v > maxMaxChars:
		return maxMaxChars
	}
	return *v
}

// ftsOperators are the characters SQLite's FTS4 parser treats as query syntax.
// storage builds its match expression by appending "*" to every whitespace
// separated word, so a quote or a colon inside an ordinary phrase produces a
// malformed expression that matches nothing at all, without an error.
const ftsOperators = `"*:^()-`

func sanitizeSearchQuery(q string) string {
	cleaned := strings.Map(func(r rune) rune {
		if strings.ContainsRune(ftsOperators, r) {
			return ' '
		}
		return r
	}, q)
	return strings.Join(strings.Fields(cleaned), " ")
}

// plainText renders an article body as text. It sanitizes first, unlike the
// web UI, which extracts straight from the stored markup: htmlutil.ExtractText
// keeps the contents of a <script> element, and script source - or whatever an
// author chose to hide in one - has no business landing in a model's context.
func plainText(link, content string) string {
	return htmlutil.ExtractText(sanitizer.Sanitize(link, content))
}

func snippet(link, content string) string {
	return htmlutil.TruncateText(plainText(link, content), snippetChars)
}

func itemTitle(title, link, content string) string {
	if title != "" {
		return title
	}
	return htmlutil.TruncateText(plainText(link, content), titleChars)
}

func truncateChars(s string, max int) (string, bool) {
	runes := []rune(s)
	if len(runes) <= max {
		return s, false
	}
	return string(runes[:max]), true
}

// The renderers below emit line-oriented prose rather than the serialized JSON
// the spec suggests for a tool that also returns structuredContent. It costs
// about half the tokens, and a client that ignores structuredContent still sees
// every field that matters.

func renderFeeds(folders []folderInfo, feeds []feedInfo, unread, starred int64) string {
	if len(feeds) == 0 {
		return "No feeds subscribed."
	}
	var b strings.Builder
	for _, f := range feeds {
		folder := "no folder"
		if f.FolderTitle != "" {
			folder = f.FolderTitle
		}
		fmt.Fprintf(&b, "[%d] %s · %s · %d unread · %d starred\n", f.ID, f.Title, folder, f.Unread, f.Starred)
		if f.Error != "" {
			fmt.Fprintf(&b, "  last refresh failed: %s\n", f.Error)
		}
	}
	fmt.Fprintf(&b, "\n%d feeds in %d folders. %d unread, %d starred.", len(feeds), len(folders), unread, starred)
	return b.String()
}

func renderItems(items []itemInfo, total int, hasMore bool, nextCursor *int64) string {
	if len(items) == 0 {
		return "No matching articles."
	}
	var b strings.Builder
	for i, it := range items {
		if i > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "[%d] %s · %s · %s\n", it.ID, it.FeedTitle, it.Date.Format(dateLayout), it.Status)
		fmt.Fprintf(&b, "%s\n", it.Title)
		if it.Link != "" {
			fmt.Fprintf(&b, "%s\n", it.Link)
		}
		if it.Snippet != "" {
			fmt.Fprintf(&b, "%s\n", it.Snippet)
		}
	}
	fmt.Fprintf(&b, "\nShowing %d of %d matches.", len(items), total)
	if hasMore && nextCursor != nil {
		fmt.Fprintf(&b, " next_cursor: %d", *nextCursor)
	}
	return b.String()
}

func renderItem(it itemInfo, content string, truncated bool, maxChars int) string {
	var b strings.Builder
	fmt.Fprintf(&b, "[%d] %s · %s · %s\n", it.ID, it.FeedTitle, it.Date.Format(dateLayout), it.Status)
	fmt.Fprintf(&b, "%s\n", it.Title)
	if it.Link != "" {
		fmt.Fprintf(&b, "%s\n", it.Link)
	}
	b.WriteString("\n")
	b.WriteString(content)
	if truncated {
		fmt.Fprintf(&b, "\n\n[truncated at %d characters; raise max_chars to read more]", maxChars)
	}
	return b.String()
}

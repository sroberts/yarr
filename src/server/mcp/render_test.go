package mcp

import (
	"strings"
	"testing"
)

// htmlutil.TruncateText looks backwards for whitespace and gives up by
// returning the whole input, so on a feed whose text has no spaces -- Chinese
// and Japanese being the obvious case -- it bounds nothing at all. A page of
// snippets would then be a page of entire article bodies.
func TestSnippetIsBoundedWithoutWhitespace(t *testing.T) {
	long := strings.Repeat("勒索軟體攻擊供水設施", 400) // 4000 runes, no spaces
	got := snippet("http://example.com", "<p>"+long+"</p>")

	if runes := len([]rune(got)); runes > snippetChars+len(" ...") {
		t.Errorf("snippet is %d runes, want <= %d", runes, snippetChars+len(" ..."))
	}
	if !strings.HasPrefix(got, "勒索軟體") {
		t.Errorf("snippet lost its content: %q", got)
	}
}

func TestSnippetKeepsShortTextIntact(t *testing.T) {
	got := snippet("http://example.com", "<p>A short item body.</p>")
	if got != "A short item body." {
		t.Errorf("got %q", got)
	}
}

// The same bound has to hold for the title fallback used when a feed gives an
// item no title.
func TestItemTitleFallbackIsBounded(t *testing.T) {
	long := strings.Repeat("勒索軟體攻擊供水設施", 400)
	got := itemTitle("", "http://example.com", "<p>"+long+"</p>")

	if runes := len([]rune(got)); runes > titleChars+len(" ...") {
		t.Errorf("title fallback is %d runes, want <= %d", runes, titleChars+len(" ..."))
	}
}

// Script contents must never reach a model: htmlutil.ExtractText keeps them,
// so the sanitizer has to run first.
func TestPlainTextDropsScriptContents(t *testing.T) {
	got := plainText("http://example.com", `<p>Real text.</p><script>alert("xss")</script>`)
	if strings.Contains(got, "alert") || strings.Contains(got, "xss") {
		t.Errorf("script content survived: %q", got)
	}
	if !strings.Contains(got, "Real text.") {
		t.Errorf("lost the real text: %q", got)
	}
}

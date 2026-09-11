package assets

import (
	"bytes"
	"strings"
	"testing"
)

// Guards issue #121: the login page — the service's front door — must render
// the anchor mark inline, name itself, and announce errors accessibly.

func TestLoginTemplateInlinesMarkAndBranding(t *testing.T) {
	var buf bytes.Buffer
	Render("login.html", &buf, map[string]interface{}{
		"settings": map[string]interface{}{"theme_name": "dark", "theme_accent": "blue"},
	})
	out := buf.String()

	// The anchor must be inlined so its stroke="currentColor" resolves to the
	// text token. As an <img> it renders black and vanishes on the dark surface.
	if strings.Contains(out, `<img src="./static/graphicarts/anchor.svg"`) {
		t.Error("anchor is still an <img>; currentColor can't resolve, so it goes invisible in dark mode")
	}
	if !strings.Contains(out, "<svg") {
		t.Error("expected the anchor SVG to be inlined into the login page")
	}
	// A guest handed a URL + credentials needs the page to say what it is.
	if !strings.Contains(out, "login-brand-name") || !strings.Contains(out, "feed reader") {
		t.Error("login page is missing the product wordmark / tagline")
	}
}

func TestLoginTemplateAnnouncesError(t *testing.T) {
	var buf bytes.Buffer
	Render("login.html", &buf, map[string]interface{}{
		"settings": map[string]interface{}{"theme_name": "light", "theme_accent": "blue"},
		"username": "alice",
		"error":    "Invalid username/password",
	})
	out := buf.String()

	if !strings.Contains(out, "Invalid username/password") {
		t.Error("error message not rendered")
	}
	// role=alert so screen readers announce the failure (the app toast has it).
	if !strings.Contains(out, `role="alert"`) {
		t.Error("error should carry role=alert for screen-reader announcement")
	}
	// the typed username survives a failed attempt
	if !strings.Contains(out, `value="alice"`) {
		t.Error("username should be preserved on error")
	}
}

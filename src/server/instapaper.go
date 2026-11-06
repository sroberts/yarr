package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

var instapaperAddURL = "https://www.instapaper.com/api/add"

// instapaperBookmarksURL is API v2's save call. A bearer token authenticates
// it, so yarr never needs the account password.
var instapaperBookmarksURL = "https://www.instapaper.com/api/2/bookmarks"

// instapaperClient bounds a save so a stalled Instapaper can't hold a request
// (or an MCP call) open indefinitely.
var instapaperClient = &http.Client{Timeout: 20 * time.Second}

// errInstapaperNotConfigured means neither an access token nor a legacy
// username and password is available.
var errInstapaperNotConfigured = errors.New("instapaper: not configured")

// InstapaperStatusError is a save Instapaper answered with a non-success
// status. Body is kept for the log, never shown to the user.
type InstapaperStatusError struct {
	Status int
	Body   string
}

func (e *InstapaperStatusError) Error() string {
	return fmt.Sprintf("instapaper: unexpected status %d: %s", e.Status, e.Body)
}

// InstapaperAdd saves a URL to Instapaper using the Simple API with HTTP Basic auth.
func InstapaperAdd(username, password, articleURL, title string) error {
	form := url.Values{}
	form.Set("url", articleURL)
	if title != "" {
		form.Set("title", title)
	}

	req, err := http.NewRequest("POST", instapaperAddURL, nil)
	if err != nil {
		return fmt.Errorf("instapaper: %w", err)
	}
	req.URL.RawQuery = form.Encode()
	req.SetBasicAuth(username, password)

	resp, err := instapaperClient.Do(req)
	if err != nil {
		return fmt.Errorf("instapaper: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		return nil
	}

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return &InstapaperStatusError{Status: resp.StatusCode, Body: string(body)}
}

// InstapaperSaveBookmark saves a URL with API v2 and an access token.
// Sending the title spares Instapaper a lookup before it answers; saving a
// URL the account already has updates that bookmark rather than duplicating it.
func InstapaperSaveBookmark(token, articleURL, title string) error {
	payload := map[string]string{"url": articleURL}
	if title != "" {
		payload["title"] = title
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("instapaper: %w", err)
	}

	req, err := http.NewRequest("POST", instapaperBookmarksURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("instapaper: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := instapaperClient.Do(req)
	if err != nil {
		return fmt.Errorf("instapaper: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return nil
	}

	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return &InstapaperStatusError{Status: resp.StatusCode, Body: string(msg)}
}

// instapaperToken is the access token to save with: the environment's
// (an Outpost secret, say) wins over the one entered in Settings.
func (s *Server) instapaperToken() string {
	if s.InstapaperToken != "" {
		return s.InstapaperToken
	}
	token, _ := s.db.GetSettingsValue("instapaper_token").(string)
	return token
}

// publicSettings is the settings map as the browser and the API see it: the
// Instapaper password and token never leave the server, only whether each is
// set (and whether the token comes from the environment, where Settings
// can't change it).
func (s *Server) publicSettings() map[string]interface{} {
	settings := s.db.GetSettings()
	password, _ := settings["instapaper_password"].(string)
	token, _ := settings["instapaper_token"].(string)
	delete(settings, "instapaper_password")
	delete(settings, "instapaper_token")
	settings["instapaper_password_set"] = password != ""
	settings["instapaper_token_set"] = token != ""
	settings["instapaper_token_env"] = s.InstapaperToken != ""
	return settings
}

// instapaperSave saves a link with whatever Instapaper access is set up:
// API v2 when there is a token, else the legacy Simple API with the stored
// username and password.
func (s *Server) instapaperSave(link, title string) error {
	if token := s.instapaperToken(); token != "" {
		return InstapaperSaveBookmark(token, link, title)
	}
	username, _ := s.db.GetSettingsValue("instapaper_username").(string)
	password, _ := s.db.GetSettingsValue("instapaper_password").(string)
	if username == "" || password == "" {
		return errInstapaperNotConfigured
	}
	return InstapaperAdd(username, password, link, title)
}

// instapaperMessage turns a failed save into the sentence the reader sees.
func instapaperMessage(err error) string {
	if errors.Is(err, errInstapaperNotConfigured) {
		return "Instapaper credentials aren't set up. Add an access token in Settings."
	}
	var se *InstapaperStatusError
	if !errors.As(err, &se) {
		return "Couldn't reach Instapaper. Check the connection and try again."
	}
	switch {
	case se.Status == http.StatusUnauthorized:
		return "Instapaper rejected the access token. Generate a new one in Settings."
	case se.Status == http.StatusForbidden:
		return "Instapaper refused the save. Check the username and password in Settings, or that your Instapaper app isn't suspended."
	case se.Status == http.StatusTooManyRequests:
		return "Instapaper is rate limiting saves. Try again shortly."
	case se.Status == http.StatusBadRequest:
		return "Instapaper couldn't save this link."
	case se.Status >= 500:
		return "Instapaper had a server error. Try again later."
	}
	return "Failed to save to Instapaper."
}

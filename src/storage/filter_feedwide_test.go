package storage

import (
	"testing"
	"time"
)

// A rule scoped to one feed with no keyword covers everything from that feed
// (Feed health's Auto-read); unscoped, it matches nothing.
func TestFeedWideFilter(t *testing.T) {
	fid := int64(3)
	if !filterMatch(Filter{Action: "read", FeedId: &fid}, 3, "anything at all") {
		t.Error("feed-wide rule should match every title in its feed")
	}
	if filterMatch(Filter{Action: "read", FeedId: &fid}, 4, "anything") {
		t.Error("feed-wide rule matched another feed")
	}
	if filterMatch(Filter{Action: "mute"}, 3, "anything") {
		t.Error("a rule with no keyword and no feed must match nothing")
	}
}

func TestApplyFeedWideFilterToUnread(t *testing.T) {
	db := testDB()
	noisy := db.CreateFeed("noisy", "", "", "http://test/noisy", nil)
	other := db.CreateFeed("other", "", "", "http://test/other", nil)
	db.CreateItems([]Item{
		{GUID: "n1", FeedId: noisy.Id, Title: "one", Date: time.Now()},
		{GUID: "n2", FeedId: noisy.Id, Title: "", Date: time.Now()},
		{GUID: "o1", FeedId: other.Id, Title: "one", Date: time.Now()},
	})
	db.CreateFilter("read", "", &noisy.Id)
	db.CreateFilter("mute", "", nil) // must be inert

	if n := db.ApplyFiltersToUnread(); n != 2 {
		t.Errorf("affected %d, want 2 (both noisy items, untitled included)", n)
	}
	unread := UNREAD
	if got := db.CountItems(ItemFilter{FeedID: &other.Id, Status: &unread}); got != 1 {
		t.Errorf("other feed has %d unread, want 1 untouched", got)
	}
	if got := db.CountItems(ItemFilter{FeedID: &noisy.Id, Status: &unread}); got != 0 {
		t.Errorf("noisy feed has %d unread, want 0", got)
	}
}

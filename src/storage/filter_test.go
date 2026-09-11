package storage

import "testing"

func TestFilterActionPrecedence(t *testing.T) {
	fid := int64(7)
	filters := []Filter{
		{Action: "read", Keyword: "daily", FeedId: nil},
		{Action: "star", Keyword: "swift", FeedId: nil},
		{Action: "mute", Keyword: "sponsored", FeedId: &fid},
	}

	cases := []struct {
		title      string
		feedId     int64
		wantStatus ItemStatus
		wantMute   bool
	}{
		{"Nothing matches here", 1, UNREAD, false},
		{"The Daily digest", 1, READ, false},
		{"New in Swift 6", 1, STARRED, false},
		{"Sponsored: buy now", 7, UNREAD, true},      // mute, right feed
		{"Sponsored: buy now", 1, UNREAD, false},     // mute scoped to feed 7 only
		{"Sponsored Swift daily", 7, STARRED, false}, // star wins over read/mute
		{"the DAILY thing", 1, READ, false},          // case-insensitive
	}
	for _, c := range cases {
		status, mute := filterAction(filters, c.feedId, c.title)
		if status != c.wantStatus || mute != c.wantMute {
			t.Errorf("filterAction(%q, feed %d) = (%v, %v); want (%v, %v)",
				c.title, c.feedId, status, mute, c.wantStatus, c.wantMute)
		}
	}
}

func TestCreateFilterAndList(t *testing.T) {
	db := testDB()
	feed := db.CreateFeed("feed", "", "", "http://test/filterlist", nil)
	db.CreateFilter("mute", "sponsored", &feed.Id)
	db.CreateFilter("star", "swift", nil)

	filters := db.ListFilters()
	if len(filters) != 2 {
		t.Fatalf("want 2 filters, got %d", len(filters))
	}
	if filters[0].Action != "mute" || filters[0].Keyword != "sponsored" || filters[0].FeedId == nil || *filters[0].FeedId != feed.Id {
		t.Errorf("unexpected first filter: %+v", filters[0])
	}
	if filters[1].FeedId != nil {
		t.Errorf("all-feeds filter should have nil FeedId, got %v", *filters[1].FeedId)
	}

	db.DeleteFilter(filters[0].Id)
	if got := db.ListFilters(); len(got) != 1 {
		t.Fatalf("want 1 filter after delete, got %d", len(got))
	}

	// deleting a feed cascades to its feed-scoped filters
	db.CreateFilter("mute", "scoped", &feed.Id)
	db.DeleteFeed(feed.Id)
	for _, f := range db.ListFilters() {
		if f.FeedId != nil {
			t.Errorf("feed-scoped filter %+v should have been removed with its feed", f)
		}
	}
}

func TestCreateItemsAppliesFilters(t *testing.T) {
	db := testDB()
	feed := db.CreateFeed("feed", "", "", "http://test/filters", nil)

	db.CreateFilter("mute", "sponsored", nil)
	db.CreateFilter("star", "swift", nil)
	db.CreateFilter("read", "digest", nil)

	db.CreateItems([]Item{
		{GUID: "a", FeedId: feed.Id, Title: "Sponsored junk"},
		{GUID: "b", FeedId: feed.Id, Title: "New in Swift"},
		{GUID: "c", FeedId: feed.Id, Title: "Weekly digest"},
		{GUID: "d", FeedId: feed.Id, Title: "A normal post"},
	})

	items := db.ListItems(ItemFilter{FeedID: &feed.Id}, 10, false, false)
	// muted item never gets inserted -> 3 remain
	if len(items) != 3 {
		t.Fatalf("want 3 items (1 muted at ingest), got %d", len(items))
	}
	byGUID := map[string]ItemStatus{}
	for _, it := range items {
		byGUID[it.GUID] = it.Status
	}
	if _, ok := byGUID["a"]; ok {
		t.Error("muted item 'a' should not exist")
	}
	if byGUID["b"] != STARRED {
		t.Errorf("item 'b' should be starred, got %v", byGUID["b"])
	}
	if byGUID["c"] != READ {
		t.Errorf("item 'c' should be read, got %v", byGUID["c"])
	}
	if byGUID["d"] != UNREAD {
		t.Errorf("item 'd' should be unread, got %v", byGUID["d"])
	}
}

func TestApplyFiltersToUnread(t *testing.T) {
	db := testDB()
	feed := db.CreateFeed("feed", "", "", "http://test/apply", nil)

	// items exist first (no filters yet)
	db.CreateItems([]Item{
		{GUID: "a", FeedId: feed.Id, Title: "Sponsored junk"},
		{GUID: "b", FeedId: feed.Id, Title: "New in Swift"},
		{GUID: "c", FeedId: feed.Id, Title: "A normal post"},
	})

	db.CreateFilter("mute", "sponsored", nil)
	db.CreateFilter("star", "swift", nil)
	affected := db.ApplyFiltersToUnread()
	if affected != 2 {
		t.Errorf("want 2 items affected, got %d", affected)
	}

	items := db.ListItems(ItemFilter{FeedID: &feed.Id}, 10, false, false)
	if len(items) != 2 {
		t.Fatalf("want 2 items after mute-delete, got %d", len(items))
	}
	for _, it := range items {
		if it.GUID == "b" && it.Status != STARRED {
			t.Errorf("item 'b' should be starred after apply, got %v", it.Status)
		}
	}
}

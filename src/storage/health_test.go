package storage

import (
	"errors"
	"testing"
	"time"
)

func healthFor(list []FeedHealth, feedId int64) *FeedHealth {
	for i := range list {
		if list[i].FeedId == feedId {
			return &list[i]
		}
	}
	return nil
}

func itemId(t *testing.T, db *Storage, feedId int64, guid string) int64 {
	t.Helper()
	var id int64
	if err := db.db.QueryRow(`select id from items where feed_id = ? and guid = ?`, feedId, guid).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestMarkItemOpenedKeepsFirstTime(t *testing.T) {
	db := testDB()
	feed := db.CreateFeed("feed", "", "", "http://test/opened", nil)
	db.CreateItems([]Item{{GUID: "a", FeedId: feed.Id, Title: "a", Date: time.Now()}})
	id := itemId(t, db, feed.Id, "a")

	if !db.MarkItemOpened(id) {
		t.Fatal("MarkItemOpened failed")
	}
	var first time.Time
	db.db.QueryRow(`select date_opened from items where id = ?`, id).Scan(&first)
	if first.IsZero() {
		t.Fatal("date_opened not set")
	}
	time.Sleep(10 * time.Millisecond)
	db.MarkItemOpened(id)
	var again time.Time
	db.db.QueryRow(`select date_opened from items where id = ?`, id).Scan(&again)
	if !again.Equal(first) {
		t.Fatalf("a second open moved date_opened: %v -> %v", first, again)
	}
}

func TestFeedHealth(t *testing.T) {
	db := testDB()
	busy := db.CreateFeed("busy", "", "", "http://test/busy", nil)
	skipped := db.CreateFeed("skipped", "", "", "http://test/skipped", nil)
	empty := db.CreateFeed("empty", "", "", "http://test/empty", nil)
	broken := db.CreateFeed("broken", "", "", "http://test/broken", nil)

	now := time.Now()
	db.CreateItems([]Item{
		{GUID: "b1", FeedId: busy.Id, Title: "opened", Date: now},
		{GUID: "b2", FeedId: busy.Id, Title: "starred and opened", Date: now},
		{GUID: "b3", FeedId: busy.Id, Title: "saved", Date: now},
		{GUID: "b4", FeedId: busy.Id, Title: "still unread", Date: now},
		{GUID: "b5", FeedId: busy.Id, Title: "old and opened", Date: now},
		{GUID: "s1", FeedId: skipped.Id, Title: "s1", Date: now},
		{GUID: "s2", FeedId: skipped.Id, Title: "s2", Date: now},
	})
	b1, b2, b3, b5 := itemId(t, db, busy.Id, "b1"), itemId(t, db, busy.Id, "b2"), itemId(t, db, busy.Id, "b3"), itemId(t, db, busy.Id, "b5")
	db.MarkItemOpened(b1)
	db.MarkItemOpened(b2)
	db.UpdateItemStatus(b1, READ)
	db.UpdateItemStatus(b2, STARRED)
	db.UpdateItemStatus(b3, READ)
	db.SetItemInstapaperSaved(b3, true)
	// b5 arrived before the window: counted in nothing but last_arrived
	db.MarkItemOpened(b5)
	db.UpdateItemStatus(b5, READ)
	db.db.Exec(`update items set date_arrived = ? where id = ?`, now.UTC().Add(-time.Hour*24*45), b5)
	db.MarkItemsRead(MarkFilter{FeedID: &skipped.Id})
	db.SetFeedError(broken.Id, errors.New("404 Not Found"))

	list := db.FeedHealth(30)
	if len(list) != 4 {
		t.Fatalf("want 4 feeds, got %d", len(list))
	}

	h := healthFor(list, busy.Id)
	want := FeedHealth{FeedId: busy.Id, Arrived: 4, Unread: 1, Engaged: 3, Opened: 2, Starred: 1, Saved: 1}
	if h.Arrived != want.Arrived || h.Unread != want.Unread || h.Engaged != want.Engaged ||
		h.Opened != want.Opened || h.Starred != want.Starred || h.Saved != want.Saved {
		t.Errorf("busy = %+v, want counts %+v", *h, want)
	}
	if h.LastArrived == nil || now.Sub(*h.LastArrived) > time.Minute {
		t.Errorf("busy last_arrived = %v, want about now", h.LastArrived)
	}

	// a wider window takes in the older item
	if h := healthFor(db.FeedHealth(60), busy.Id); h.Arrived != 5 || h.Opened != 3 {
		t.Errorf("busy over 60 days = %+v, want arrived 5, opened 3", *h)
	}

	if h := healthFor(list, skipped.Id); h.Arrived != 2 || h.Unread != 0 || h.Engaged != 0 {
		t.Errorf("skipped = %+v, want 2 arrived, all decided, none engaged", *h)
	}

	if h := healthFor(list, empty.Id); h.Arrived != 0 || h.LastArrived != nil {
		t.Errorf("empty = %+v, want no items and no last_arrived", *h)
	}

	if h := healthFor(list, broken.Id); h.Error != "404 Not Found" {
		t.Errorf("broken error = %q", h.Error)
	}
}

func TestFeedHealthClampsWindow(t *testing.T) {
	db := testDB()
	feed := db.CreateFeed("feed", "", "", "http://test/clamp", nil)
	db.CreateItems([]Item{{GUID: "old", FeedId: feed.Id, Title: "old", Date: time.Now()}})
	db.db.Exec(`update items set date_arrived = ?`, time.Now().UTC().Add(-time.Hour*24*time.Duration(FeedHealthMaxDays+30)))

	if h := healthFor(db.FeedHealth(10000), feed.Id); h.Arrived != 0 {
		t.Errorf("window past the retention limit counted %d items", h.Arrived)
	}
	if h := healthFor(db.FeedHealth(0), feed.Id); h == nil {
		t.Error("a zero window should clamp to one day, not fail")
	}
}

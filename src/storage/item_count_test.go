package storage

import (
	"testing"
	"time"
)

// CountItems shares its predicate builder with ListItems, which refers to the
// items table as `i`. When the alias went missing from the count query, every
// filtered count failed as invalid SQL and returned 0 -- invisibly, because
// the only caller at the time passed an empty filter.
func TestCountItemsWithFilter(t *testing.T) {
	db := testDB()

	folder := db.CreateFolder("folder")
	feed1 := db.CreateFeed("feed1", "", "http://example.com", "http://example.com/feed", &folder.Id)
	feed2 := db.CreateFeed("feed2", "", "http://other.com", "http://other.com/feed", nil)

	db.CreateItems([]Item{
		{GUID: "1", FeedId: feed1.Id, Title: "one", Date: time.Now()},
		{GUID: "2", FeedId: feed1.Id, Title: "two", Date: time.Now()},
		{GUID: "3", FeedId: feed2.Id, Title: "three", Date: time.Now()},
	})
	db.UpdateItemStatus(2, READ)

	unread := UNREAD
	read := READ

	for _, tc := range [...]struct {
		name     string
		filter   ItemFilter
		expected int
	}{
		{name: "no filter", filter: ItemFilter{}, expected: 3},
		{name: "by feed", filter: ItemFilter{FeedID: &feed1.Id}, expected: 2},
		{name: "by other feed", filter: ItemFilter{FeedID: &feed2.Id}, expected: 1},
		{name: "by folder", filter: ItemFilter{FolderID: &folder.Id}, expected: 2},
		{name: "by status", filter: ItemFilter{Status: &unread}, expected: 2},
		{name: "by status read", filter: ItemFilter{Status: &read}, expected: 1},
		{name: "feed and status", filter: ItemFilter{FeedID: &feed1.Id, Status: &unread}, expected: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := db.CountItems(tc.filter); got != tc.expected {
				t.Errorf("expected %d, got %d", tc.expected, got)
			}
		})
	}
}

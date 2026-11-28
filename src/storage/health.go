package storage

import (
	"database/sql"
	"log"
	"math"
	"time"
)

// FeedHealthMaxDays caps the window: older items are pruned (itemsKeepDays),
// so a longer window would quietly count less than it claims.
var FeedHealthMaxDays = itemsKeepDays

// FeedHealth is one feed's triage record over a recent window: what arrived,
// what is still waiting, and what the reader actually engaged with. It lets
// the UI tell a feed that is broken, gone quiet, or always skipped.
type FeedHealth struct {
	FeedId int64 `json:"feed_id"`
	// Arrived in the window.
	Arrived int64 `json:"arrived"`
	// Of those, still unread: not yet decided either way.
	Unread int64 `json:"unread"`
	// Of those, opened, starred, or sent to Instapaper (each counted once).
	Engaged int64 `json:"engaged"`
	Opened  int64 `json:"opened"`
	Starred int64 `json:"starred"`
	Saved   int64 `json:"saved"`
	// The newest item's arrival, at any age; nil if the feed has none.
	LastArrived *time.Time `json:"last_arrived"`
	// The last fetch error, if the feed currently has one.
	Error string `json:"error,omitempty"`
}

// MarkItemOpened records the first time an item was opened to read; later
// opens keep that first time.
func (s *Storage) MarkItemOpened(id int64) bool {
	_, err := s.db.Exec(`update items set date_opened = ? where id = ? and date_opened is null`, time.Now().UTC(), id)
	if err != nil {
		log.Print(err)
		return false
	}
	return true
}

// FeedHealthWindow shortens a requested window to the days since feed
// health began recording opens (the feed_health_since setting, m14), rounded
// up: articles from before it have no opens on file, and counting them
// would call every feed skipped.
func (s *Storage) FeedHealthWindow(days int) int {
	since := s.GetSettingsValueInt64("feed_health_since")
	if since <= 0 {
		return days
	}
	tracked := int(math.Ceil(time.Since(time.Unix(since, 0)).Hours() / 24))
	if tracked < 1 {
		tracked = 1
	}
	if tracked < days {
		return tracked
	}
	return days
}

// FeedHealth reports every feed's record over the last `days` days (clamped
// to 1..FeedHealthMaxDays), feeds with no items included.
func (s *Storage) FeedHealth(days int) []FeedHealth {
	if days < 1 {
		days = 1
	}
	if days > FeedHealthMaxDays {
		days = FeedHealthMaxDays
	}
	since := time.Now().UTC().Add(-time.Hour * 24 * time.Duration(days))
	// read before the main query: a nested query needs a second connection
	errors := s.GetFeedErrors()
	rows, err := s.db.Query(`
		select
			f.id,
			coalesce(sum(i.date_arrived >= ?1), 0),
			coalesce(sum(i.date_arrived >= ?1 and i.status = ?2), 0),
			coalesce(sum(i.date_arrived >= ?1 and (i.date_opened is not null or i.status = ?3 or i.instapaper_saved)), 0),
			coalesce(sum(i.date_arrived >= ?1 and i.date_opened is not null), 0),
			coalesce(sum(i.date_arrived >= ?1 and i.status = ?3), 0),
			coalesce(sum(i.date_arrived >= ?1 and i.instapaper_saved), 0),
			cast(strftime('%s', max(i.date_arrived)) as integer)
		from feeds f
		left join items i on i.feed_id = f.id
		group by f.id
		order by f.id
	`, since, UNREAD, STARRED)
	if err != nil {
		log.Print(err)
		return nil
	}
	defer rows.Close()

	result := make([]FeedHealth, 0)
	for rows.Next() {
		var h FeedHealth
		var last sql.NullInt64
		if err := rows.Scan(&h.FeedId, &h.Arrived, &h.Unread, &h.Engaged, &h.Opened, &h.Starred, &h.Saved, &last); err != nil {
			log.Print(err)
			return nil
		}
		if last.Valid {
			t := time.Unix(last.Int64, 0).UTC()
			h.LastArrived = &t
		}
		h.Error = errors[h.FeedId]
		result = append(result, h)
	}
	return result
}

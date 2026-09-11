package storage

import (
	"database/sql"
	"log"
	"strings"
	"time"
)

// Filter is a deterministic pre-triage rule applied to incoming items on
// refresh: auto-read, auto-star, or mute (drop) items whose title contains a
// keyword, optionally scoped to one feed. Local-only; no ML, no network.
type Filter struct {
	Id        int64     `json:"id"`
	Action    string    `json:"action"` // "read" | "star" | "mute"
	Keyword   string    `json:"keyword"`
	FeedId    *int64    `json:"feed_id"` // nil = all feeds
	CreatedAt time.Time `json:"created_at"`
}

var filterActions = map[string]bool{"read": true, "star": true, "mute": true}

// ValidFilterAction reports whether a is a supported filter action.
func ValidFilterAction(a string) bool { return filterActions[a] }

func (s *Storage) CreateFilter(action, keyword string, feedId *int64) *Filter {
	now := time.Now().UTC()
	row := s.db.QueryRow(`
		insert into filters (action, keyword, feed_id, created_at)
		values (?, ?, ?, ?)
		returning id`,
		action, keyword, feedId, now,
	)
	var id int64
	if err := row.Scan(&id); err != nil {
		log.Print(err)
		return nil
	}
	return &Filter{Id: id, Action: action, Keyword: keyword, FeedId: feedId, CreatedAt: now}
}

func (s *Storage) DeleteFilter(id int64) bool {
	_, err := s.db.Exec(`delete from filters where id = ?`, id)
	if err != nil {
		log.Print(err)
	}
	return err == nil
}

func (s *Storage) ListFilters() []Filter {
	result := make([]Filter, 0)
	rows, err := s.db.Query(`
		select id, action, keyword, feed_id, created_at
		from filters order by created_at`)
	if err != nil {
		log.Print(err)
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var f Filter
		if err := rows.Scan(&f.Id, &f.Action, &f.Keyword, &f.FeedId, &f.CreatedAt); err != nil {
			log.Print(err)
			return result
		}
		result = append(result, f)
	}
	return result
}

// filterMatch reports whether a filter applies to an item's feed and title
// (case-insensitive substring on the title).
func filterMatch(f Filter, feedId int64, title string) bool {
	if f.FeedId != nil && *f.FeedId != feedId {
		return false
	}
	if f.Keyword == "" {
		return false
	}
	return strings.Contains(strings.ToLower(title), strings.ToLower(f.Keyword))
}

// filterAction resolves the effective action for an item against all filters.
// Precedence is star > read > mute (keep beats hide). Returns the resulting
// status and whether the item should be muted (dropped at ingest).
func filterAction(filters []Filter, feedId int64, title string) (status ItemStatus, mute bool) {
	var star, read, muted bool
	for _, f := range filters {
		if !filterMatch(f, feedId, title) {
			continue
		}
		switch f.Action {
		case "star":
			star = true
		case "read":
			read = true
		case "mute":
			muted = true
		}
	}
	switch {
	case star:
		return STARRED, false
	case read:
		return READ, false
	case muted:
		return UNREAD, true
	}
	return UNREAD, false
}

// ApplyFiltersToUnread runs all filters against existing UNREAD items and
// applies them in precedence order (star, then read, then mute-delete); each
// pass only touches items still unread, so star/read protect an item from a
// later mute. Returns the number of items affected. Used by "apply to existing"
// so a new rule can clean the current backlog.
func (s *Storage) ApplyFiltersToUnread() int64 {
	filters := s.ListFilters()
	var affected int64

	apply := func(action, stmt string) {
		for _, f := range filters {
			if f.Action != action {
				continue
			}
			like := "%" + strings.ToLower(f.Keyword) + "%"
			var res sql.Result
			var err error
			if f.FeedId != nil {
				res, err = s.db.Exec(stmt+` and feed_id = ? and lower(title) like ?`, *f.FeedId, like)
			} else {
				res, err = s.db.Exec(stmt+` and lower(title) like ?`, like)
			}
			if err != nil {
				log.Print(err)
				continue
			}
			if n, e := res.RowsAffected(); e == nil {
				affected += n
			}
		}
	}

	apply("star", `update items set status = 2 where status = 0`)
	apply("read", `update items set status = 1 where status = 0`)
	apply("mute", `delete from items where status = 0`)
	return affected
}

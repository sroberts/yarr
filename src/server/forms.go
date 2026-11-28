package server

import "github.com/nkanaev/yarr/src/storage"

type ItemUpdateForm struct {
	Status *storage.ItemStatus `json:"status,omitempty"`
	// Opened records that the item was opened to read (feed health). Only
	// true does anything; the first time is kept.
	Opened *bool `json:"opened,omitempty"`
}

type FolderCreateForm struct {
	Title string `json:"title"`
}

type FolderUpdateForm struct {
	Title      *string `json:"title,omitempty"`
	IsExpanded *bool   `json:"is_expanded,omitempty"`
}

type FeedCreateForm struct {
	Url      string `json:"url"`
	FolderID *int64 `json:"folder_id,omitempty"`
}

type FilterCreateForm struct {
	Action   string `json:"action"`
	Keyword  string `json:"keyword"`
	FeedID   *int64 `json:"feed_id,omitempty"`
	ApplyNow bool   `json:"apply_now,omitempty"`
}

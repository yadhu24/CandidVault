-- 0005_add_upload_favorite.sql
-- Intent: let the photographer "favorite" an upload for quick access. An event
-- has a single owner in the MVP, so favorites are one boolean per upload — a
-- per-user favorites table would be overengineering. The partial index serves
-- the gallery's "favorites only" filter without scanning non-favorites.
-- Risk: additive only — one defaulted boolean column + one partial index. The
-- default backfills existing rows in place; no data is rewritten or dropped.

ALTER TABLE uploads
  ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX idx_uploads_event_favorite
  ON uploads (event_id, created_at DESC)
  WHERE is_favorite;  -- serves the gallery "favorites only" feed

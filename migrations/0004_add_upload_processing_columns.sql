-- 0004_add_upload_processing_columns.sql
-- Intent: make the worker's async processing observable and retry-safe. The
-- uploads.status column already drives the DB-backed job queue (pending →
-- processing → ready/failed); these columns record WHY a job failed, HOW many
-- times it has been attempted (to cap retries and recover crashed jobs), and
-- WHEN it settled. This satisfies CLAUDE.md §9 ("worker errors are recorded
-- against the job — status + error detail — so failures are observable and
-- retryable").
-- Risk: additive only — new nullable columns plus one defaulted column. The
-- default backfills existing rows in place; no data is rewritten or dropped.

ALTER TABLE uploads
  ADD COLUMN processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN processing_error    text,
  ADD COLUMN processed_at        timestamptz;

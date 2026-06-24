-- 0007_add_worker_heartbeats.sql
-- Intent: liveness tracking for the background worker. The worker upserts its row
-- on a fixed interval; the /api/health endpoint reads the most recent beat to tell
-- whether the worker is alive (so an uptime monitor can alert when it dies).
--
-- One row per worker instance (keyed by worker_id, e.g. hostname), so multiple
-- workers can each report independently.
--
-- Risk: additive only (one small table). No backfill, no destructive change. RLS
-- enabled (no policies) to match 0003 — the app/worker connect as the owner and
-- bypass RLS; the Supabase Data API is denied by default.
-- Rollback: DROP TABLE worker_heartbeats;

CREATE TABLE worker_heartbeats (
  worker_id    text PRIMARY KEY,
  last_beat_at timestamptz NOT NULL DEFAULT now(),
  detail       jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;

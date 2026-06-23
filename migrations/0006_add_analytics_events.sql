-- 0006_add_analytics_events.sql
-- Intent: a lightweight, append-only product analytics log. One row per tracked
-- product event (event_created, upload_completed, export_requested, …) written
-- by lib/analytics/track. Powers a simple internal summary query/CLI; it is not
-- on any hot read path.
--
-- Design:
--   * name              app-level enum is the source of truth (lib/analytics/
--                       events.ts); kept as plain text so adding an event later
--                       needs no migration.
--   * event_id/actor_id nullable FKs, ON DELETE SET NULL — analytics must never
--                       block deleting an event or user, and history outlives them.
--   * actor_type        'guest' | 'photographer' | 'system' (who triggered it).
--   * properties        jsonb for per-event context (e.g. {"reason":"validation"},
--                       {"mediaType":"photo"}, {"itemCount":42}). No PII/secrets.
--   * append-only       no updated_at / trigger — rows are never mutated.
--
-- Risk: additive only (new table + indexes). No backfill, no row rewrites, no
-- destructive changes. RLS is ENABLEd (not FORCEd) with no policies, matching the
-- security model in 0003: the app connects as the owning role and bypasses RLS,
-- while the Supabase Data API (anon/authenticated) is denied by default.
-- Rollback: DROP TABLE analytics_events;

CREATE TABLE analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  event_id    uuid REFERENCES events (id) ON DELETE SET NULL,
  actor_id    uuid REFERENCES users (id) ON DELETE SET NULL,
  actor_type  text NOT NULL DEFAULT 'system'
              CONSTRAINT analytics_events_actor_type_check
              CHECK (actor_type IN ('guest', 'photographer', 'system')),
  properties  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Summary query: counts grouped by event name over a time range.
CREATE INDEX idx_analytics_events_name_created ON analytics_events (name, created_at DESC);
-- Per-event analytics (e.g. a future event dashboard); partial since system-wide
-- events (none currently) would carry a null event_id.
CREATE INDEX idx_analytics_events_event_created ON analytics_events (event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

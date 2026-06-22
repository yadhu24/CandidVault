-- 0002_add_event_type_and_venue.sql
-- Intent: events now capture a categorical type (wedding, corporate, …) and an
-- optional venue, to support the Create Event flow and event overview.
-- Risk: additive only. event_type is NOT NULL with a 'other' default so the one
-- existing/seed row backfills cleanly; the application always supplies a real
-- value. venue is nullable. No table rewrite (constant default is metadata-only
-- in modern Postgres). No data dropped.

ALTER TABLE events
  ADD COLUMN event_type text NOT NULL DEFAULT 'other'
    CONSTRAINT events_event_type_check
    CHECK (event_type IN ('wedding', 'engagement', 'birthday', 'corporate', 'party', 'other')),
  ADD COLUMN venue text;

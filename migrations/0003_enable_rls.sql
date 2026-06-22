-- 0003_enable_rls.sql
-- Intent: enable Row Level Security on every table in the public schema. Supabase
-- exposes a public Data API (PostgREST) that is reachable with the anon key — and
-- the anon key ships in the browser bundle, so it is effectively public. With RLS
-- off, anon/authenticated hold default grants on these tables, meaning anyone
-- could read or write application data directly through that API, bypassing the
-- app entirely (including the secret token columns on guest_sessions and
-- event_qr_codes). This migration closes that hole and clears the linter's
-- CRITICAL "RLS Disabled in Public" and "Sensitive Columns Exposed" findings.
--
-- Security model (why there are no policies here):
--   * The application connects to Postgres directly as the `postgres` role, which
--     OWNS these tables and therefore BYPASSES RLS. We use ENABLE — NOT FORCE —
--     row level security on purpose, so the app's own queries are completely
--     unaffected.
--   * RLS enabled with no policy = deny-all for non-owner roles. That denies the
--     anon/authenticated Data API by default, which is exactly what we want: the
--     app never uses the Data API.
--   * Photographer ownership, guest-session scoping, and public-by-slug access are
--     all enforced in the application layer (lib/), not via the Data API, so no
--     auth.uid() policies are added. If a future feature talks to Supabase from
--     the browser via supabase-js, add scoped policies in a later migration then.
--
-- Risk: non-destructive and reversible. No rows are read, written, or dropped.
-- Because the owning role bypasses RLS, existing functionality is unaffected.
-- Rollback: ALTER TABLE <name> DISABLE ROW LEVEL SECURITY; for each table below.

ALTER TABLE schema_migrations     ENABLE ROW LEVEL SECURITY;  -- migrations ledger (created by scripts/migrate.mjs)
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE photographer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_qr_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums                ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports               ENABLE ROW LEVEL SECURITY;

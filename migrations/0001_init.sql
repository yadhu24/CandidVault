-- 0001_init.sql
-- Intent: establish the baseline CandidVault MVP schema — identity, events and
-- their QR codes, anonymous guest sessions, uploaded media + derived variants,
-- photographer-curated albums, a moderation audit trail, and ZIP export jobs.
-- Risk: greenfield baseline. Creates new tables/indexes/triggers only; no data
-- is rewritten or dropped. Safe to run on an empty database.
--
-- Conventions (CLAUDE.md §4, §6):
--   * snake_case, plural table names; PK is `id`; FKs are `<entity>_id`.
--   * Enumerated columns use `text` + a named CHECK rather than native ENUM, so
--     values can evolve with an ordinary migration (drop/recreate the CHECK)
--     instead of `ALTER TYPE`. This also lines up 1:1 with the string-literal
--     union types in lib/db/types.ts.
--   * `created_at` everywhere; `updated_at` on mutable rows, kept honest by the
--     shared set_updated_at() trigger below.

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Keeps updated_at correct regardless of how a row is written (app, worker, psql).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- One row per authenticated account. `id` mirrors the Supabase Auth user id;
-- the app inserts it explicitly on signup. We deliberately do NOT add a foreign
-- key to auth.users so these migrations stay portable (local dev / CI can run
-- against a plain Postgres without the Supabase `auth` schema). Integrity
-- between auth and app users is maintained at the application layer.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         text NOT NULL DEFAULT 'photographer'
               CONSTRAINT users_role_check CHECK (role IN ('photographer', 'admin')),
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness; the app stores emails lowercased but this is the
-- real guard against Foo@x.com / foo@x.com duplicates.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- photographer_profiles
-- 1:1 extension of users for business/contact details. Kept separate from
-- users so identity stays minimal and future non-photographer roles (e.g. a
-- pure guest account) don't carry empty business columns.
-- ---------------------------------------------------------------------------
CREATE TABLE photographer_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  business_name text,
  contact_email text,
  contact_phone text,
  website_url   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_photographer_profiles_updated_at BEFORE UPDATE ON photographer_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- events
-- Owned by a photographer. `slug` is the public, unguessable token used at
-- /e/[slug] (the QR target). `cover_upload_id` is wired up after `uploads`
-- exists (circular reference; see the ALTER below).
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'draft'
                  CONSTRAINT events_status_check CHECK (status IN ('draft', 'active', 'closed')),
  event_date      date,
  cover_upload_id uuid,  -- FK added after uploads is created
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Serves the dashboard's "my events, newest first" list.
CREATE INDEX idx_events_photographer_created ON events (photographer_id, created_at DESC);

CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- event_qr_codes
-- A physical/printed QR artifact for an event. Modeled as its own table (not a
-- single column on events) so a photographer can mint multiple codes per event
-- — placement-labeled ("Entrance", "Table 5"), individually revocable, and
-- reprintable — without touching the event's canonical URL.
-- ---------------------------------------------------------------------------
CREATE TABLE event_qr_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,  -- opaque value encoded in the QR / short link
  label      text,
  is_active  boolean NOT NULL DEFAULT true,
  scan_count integer NOT NULL DEFAULT 0,  -- coarse analytics; see scaling note in PR
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_qr_codes_event ON event_qr_codes (event_id);

CREATE TRIGGER trg_event_qr_codes_updated_at BEFORE UPDATE ON event_qr_codes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- guest_sessions
-- An anonymous (usually account-less) uploader on a single event. Groups a
-- guest's uploads, remembers the name they typed, records which QR they came
-- through, and gives unauthenticated abuse-control / rate-limiting a subject.
-- ---------------------------------------------------------------------------
CREATE TABLE guest_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  qr_code_id   uuid REFERENCES event_qr_codes (id) ON DELETE SET NULL,
  display_name text,
  token        text NOT NULL UNIQUE,  -- stored in the guest's cookie / localStorage
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_sessions_event ON guest_sessions (event_id);

-- ---------------------------------------------------------------------------
-- uploads
-- The core media row: one per original file in R2. Two independent state
-- machines: `status` is the async processing pipeline (worker), and
-- `moderation_status` is the photographer's approve/reject decision. Promoted
-- columns (width/height/duration/captured_at) exist for display + sorting; the
-- jsonb `metadata` holds the long tail of EXIF. Do not store guest PII here.
-- ---------------------------------------------------------------------------
CREATE TABLE uploads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  guest_session_id  uuid REFERENCES guest_sessions (id) ON DELETE SET NULL,
  uploader_name     text,  -- denormalized; the photographer may upload without a guest session
  media_type        text NOT NULL
                    CONSTRAINT uploads_media_type_check CHECK (media_type IN ('photo', 'video')),
  status            text NOT NULL DEFAULT 'pending'
                    CONSTRAINT uploads_status_check CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  moderation_status text NOT NULL DEFAULT 'pending'
                    CONSTRAINT uploads_moderation_status_check CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  storage_key       text NOT NULL UNIQUE,  -- events/{eventId}/original/...; unique => idempotent confirm
  original_filename text,
  mime_type         text NOT NULL,
  file_size_bytes   bigint NOT NULL
                    CONSTRAINT uploads_file_size_check CHECK (file_size_bytes > 0),
  checksum          text,  -- optional client-supplied hash for dedupe / idempotency
  width             integer,
  height            integer,
  duration_seconds  double precision,  -- video only
  captured_at       timestamptz,       -- from EXIF, when available
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Gallery: an event's media, newest first (primary list / pagination path).
CREATE INDEX idx_uploads_event_created ON uploads (event_id, created_at DESC);
-- Moderation queue: filter an event's media by decision.
CREATE INDEX idx_uploads_event_moderation ON uploads (event_id, moderation_status);
-- "Show this guest their own uploads".
CREATE INDEX idx_uploads_guest_session ON uploads (guest_session_id);
-- Worker poll: fetch unfinished work only. Partial index stays small as the
-- table grows because finished rows drop out of it.
CREATE INDEX idx_uploads_pending_processing ON uploads (created_at)
  WHERE status IN ('pending', 'processing');

CREATE TRIGGER trg_uploads_updated_at BEFORE UPDATE ON uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Now that uploads exists, close the events -> uploads cover reference.
ALTER TABLE events
  ADD CONSTRAINT events_cover_upload_id_fkey
  FOREIGN KEY (cover_upload_id) REFERENCES uploads (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- upload_variants
-- Derived renditions produced by the worker (thumbnail for grids, preview for
-- the lightbox, web for inline playback). UNIQUE(upload_id, variant) makes
-- regeneration idempotent: re-running a job upserts the one row per kind.
-- ---------------------------------------------------------------------------
CREATE TABLE upload_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       uuid NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  variant         text NOT NULL
                  CONSTRAINT upload_variants_variant_check CHECK (variant IN ('thumbnail', 'preview', 'web')),
  storage_key     text NOT NULL UNIQUE,
  mime_type       text NOT NULL,
  width           integer,
  height          integer,
  file_size_bytes bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_upload_variants_upload_variant UNIQUE (upload_id, variant)
);

CREATE INDEX idx_upload_variants_upload ON upload_variants (upload_id);

-- ---------------------------------------------------------------------------
-- albums
-- Photographer-curated grouping within an event (e.g. "Ceremony", "Selects").
-- `position` allows manual ordering in the dashboard.
-- ---------------------------------------------------------------------------
CREATE TABLE albums (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_albums_event ON albums (event_id);

CREATE TRIGGER trg_albums_updated_at BEFORE UPDATE ON albums
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- album_items
-- Many-to-many membership of uploads in albums (an upload may belong to several
-- albums). Surrogate `id` per CLAUDE.md, with UNIQUE(album_id, upload_id) to
-- prevent duplicate membership.
-- ---------------------------------------------------------------------------
CREATE TABLE album_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   uuid NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  upload_id  uuid NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_album_items_album_upload UNIQUE (album_id, upload_id)
);

-- List an album's contents in order.
CREATE INDEX idx_album_items_album_position ON album_items (album_id, position);
-- Reverse lookup: which albums contain a given upload.
CREATE INDEX idx_album_items_upload ON album_items (upload_id);

-- ---------------------------------------------------------------------------
-- moderation_actions
-- Append-only audit trail of moderation decisions. uploads.moderation_status is
-- the denormalized current state for fast filtering; this table is the history
-- of how it got there and who decided. actor_id is nullable + SET NULL so the
-- audit survives if a user is removed.
-- ---------------------------------------------------------------------------
CREATE TABLE moderation_actions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id  uuid NOT NULL REFERENCES uploads (id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES users (id) ON DELETE SET NULL,
  action     text NOT NULL
             CONSTRAINT moderation_actions_action_check CHECK (action IN ('approve', 'reject', 'restore', 'delete')),
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_actions_upload ON moderation_actions (upload_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- exports
-- A ZIP build job for an event, produced asynchronously by the worker. `scope`
-- selects what goes in; `storage_key` is null until the build is ready.
-- `status` mirrors the uploads pipeline vocabulary for consistency.
-- ---------------------------------------------------------------------------
CREATE TABLE exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  requested_by    uuid REFERENCES users (id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CONSTRAINT exports_status_check CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  scope           text NOT NULL DEFAULT 'all'
                  CONSTRAINT exports_scope_check CHECK (scope IN ('all', 'approved', 'album')),
  album_id        uuid REFERENCES albums (id) ON DELETE SET NULL,  -- required when scope = 'album'
  storage_key     text,        -- R2 key of the built zip; null until ready
  file_size_bytes bigint,
  item_count      integer,
  error_detail    text,        -- populated when status = 'failed'
  expires_at      timestamptz, -- for signed-download / cleanup windows
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exports_album_scope_check
    CHECK (scope <> 'album' OR album_id IS NOT NULL)  -- album exports must name an album
);

-- An event's export history, newest first.
CREATE INDEX idx_exports_event_created ON exports (event_id, created_at DESC);
-- Worker poll for unfinished exports.
CREATE INDEX idx_exports_pending ON exports (created_at)
  WHERE status IN ('pending', 'processing');

CREATE TRIGGER trg_exports_updated_at BEFORE UPDATE ON exports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

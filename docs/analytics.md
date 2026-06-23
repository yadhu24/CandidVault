# Analytics & Instrumentation

A deliberately small, self-hosted product-event log — no third-party analytics
SDK, no client tracking pixels. Events are written to one `analytics_events`
table and read back with a summary query / CLI. Analytics is **best-effort and
non-blocking**: it must never break or slow a product flow.

## Event schema

One row per tracked event (`migrations/0006_add_analytics_events.sql`):

| Column | Meaning |
|---|---|
| `id` | uuid PK |
| `name` | event name — the app enum in `lib/analytics/events.ts` is the source of truth (column is plain `text`, so adding an event is a code change, not a migration) |
| `event_id` | the event it relates to (nullable FK, `ON DELETE SET NULL`) |
| `actor_id` | the user who triggered it, for photographer actions (nullable FK to `users`) |
| `actor_type` | `guest` \| `photographer` \| `system` |
| `properties` | `jsonb` for per-event context (e.g. `{"reason":"validation"}`, `{"mediaType":"photo"}`, `{"itemCount":42}`). **No PII/secrets** — never IPs, names, tokens |
| `created_at` | timestamptz |

Append-only (no `updated_at`/trigger). RLS enabled with no policies, matching
`0003` — the app bypasses it as table owner; the Supabase Data API is denied.

## Tracked events

| Event | Where | Side | actor |
|---|---|---|---|
| `event_created` | `lib/events/actions.ts` | backend | photographer |
| `qr_downloaded` | `app/api/events/[id]/qr` | backend | photographer |
| `link_copied` | `components/events/CopyLinkButton.tsx` | **frontend** | photographer |
| `public_page_opened` | `app/e/[slug]/page.tsx` (`after()`) | backend | guest |
| `upload_started` | `app/e/[slug]/GuestUploader.tsx` | **frontend** | guest |
| `upload_completed` | `app/api/e/[slug]/uploads` | backend | guest |
| `upload_failed` | `…/uploads` + `…/upload-sessions` | backend | guest |
| `upload_approved` | `lib/moderation/actions.ts` | backend | photographer |
| `upload_rejected` | `lib/moderation/actions.ts` | backend | photographer |
| `export_requested` | `lib/exports/actions.ts` | backend | photographer |
| `export_completed` | `lib/jobs/build-export.ts` (worker) | backend | system |

**Why this split:** money/abuse-relevant and outcome events are server-
authoritative so they can't be spoofed or inflated by a browser. Only two events
are inherently client-side (`link_copied`, a clipboard action; `upload_started`,
the moment a user picks files) and are reported via a beacon to `POST /api/analytics`,
which only accepts that whitelisted subset (`CLIENT_ANALYTICS_EVENTS`).

### Upload failure reasons

`upload_failed` always carries a `reason` in `properties` so the funnel is
debuggable:

- `file_too_large`, `cap_count`, `cap_bytes` — rejected at presign (before bytes upload)
- `event_inactive`, `missing_parts`, `multipart_assembly`, `object_missing`,
  `validation`, `cap_count`/`cap_bytes`, `internal` — rejected at confirm

(Client-side pre-validation rejects — unsupported type / too large before any
network call — are surfaced in the UI but not logged; an accepted MVP gap.)

## Implementation

- **`lib/analytics/track.ts`** — `track(name, { eventId, actorId, actorType,
  properties })`. Server-only (imports the pg query layer). Swallows its own
  errors. In Next runtimes it's wrapped in `after()` so it runs after the
  response without adding latency; the worker calls it with `await` directly.
- **`lib/analytics/client.ts`** — `trackClient(name, { eventId, properties })`.
  Uses `navigator.sendBeacon` (falls back to `fetch keepalive`); never throws.
- **`app/api/analytics/route.ts`** — validates against the client whitelist,
  derives the actor from the session (never the body), IP rate-limited, bounds
  `properties` size, and always returns `204`.

## Reading the data

Query: `getAnalyticsSummary({ eventId?, since?, until? })` in
`lib/db/queries/analytics.ts` — counts grouped by name, optionally scoped to one
event and/or a time window (parameterized; safe to call with user input).

CLI:

```bash
npm run analytics:summary                 # all events, all time
npm run analytics:summary -- --days 7     # last 7 days
npm run analytics:summary -- --event <id> # one event
```

It prints per-event counts plus the upload funnel (started → completed → failed,
with success rate) and export funnel (requested → completed).

## Notes / future work

- **Counts, not exact uploads, for moderation.** `upload_approved`/`rejected`
  write one row per moderation action with `properties.count`; sum `count` for
  exact totals, or count rows for "number of actions".
- **Volume.** This is an append-heavy table; for high traffic add time-based
  partitioning or periodic rollups, and prune raw rows. Not needed at MVP scale.
- **No dashboard UI.** The summary is CLI/query-only by design. The
  `idx_analytics_events_event_created` index already supports a future per-event
  dashboard widget without schema changes.

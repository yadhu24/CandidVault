# Next-Phase Backlog

A structured backlog from a review of the MVP. Priorities:

- **P0** — blocks a pilot / charging money / risks data loss or a security breach.
- **P1** — needed soon (before scaling past a handful of customers).
- **P2** — valuable, can wait.

Grounded in the current code; file references included where useful. See also
[`security.md`](./security.md), [`pilot-readiness.md`](./pilot-readiness.md),
[`exports.md`](./exports.md), [`testing.md`](./testing.md).

---

## Bugs

| P | Item | Notes |
|---|------|-------|
| ~~P0~~ ✅ | **Moderation queue shows only the first ~50 uploads** | **Shipped.** Infinite-scroll load-more via `GET /api/events/[id]/uploads` + `lib/moderation/serialize.ts`, mirroring the gallery; decisions update optimistically. |
| **P0** | **Verify HEIC decode in the deployed worker** | iPhone's default is HEIC. `lib/media/image.ts` transcodes via `sharp`; prebuilt `sharp`/libvips may not include HEIF decode. If it fails, iPhone uploads never get a viewable JPEG/thumbnail. Verify end-to-end on the worker image; if missing, add libheif or a fallback. |
| **P1** | **Presigned thumbnail URLs expire after 15 min** | Galleries/moderation presign at render; a tab left open >15 min shows broken images until reload. Refresh on focus, or lengthen TTL for derivatives. |
| **P2** | **Stale-export auto-fail window is fixed at 10 min** | A very large export could exceed it and get marked failed mid-build. Make the stale threshold proportional to size, or heartbeat the job. |

---

## Hardening tasks

| P | Item | Notes |
|---|------|-------|
| **P0** | **Rotate all secrets that appeared in chat/logs** | DB password, R2 keys, `UPLOAD_SIGNING_SECRET`. Do before production. |
| **P0** | **R2 bucket: confirm private + CORS + lifecycle rules** | Private bucket; CORS `PUT/GET/HEAD` + `ExposeHeaders: ETag`; lifecycle to abort incomplete multipart uploads (~1 day) and expire `exports/` (7 days). Without the abort rule, abandoned guest uploads accrue cost silently. |
| **P0** | **Database + R2 backup/retention policy** | No documented backups. A dropped DB or bucket = total loss of customer media. Enable PITR/backups on both and test a restore. |
| **P1** | **Shared rate-limit store (Redis/Upstash)** | `lib/http/rate-limit.ts` is in-memory/per-process — ineffective on Vercel's multiple instances. Per-event DB caps are the real ceiling today; add a shared store before real traffic. |
| **P1** | **Event delete leaves R2 objects** | `deleteEventForPhotographer` cascades DB rows but not storage. If you promise "delete my event," the originals still exist in R2 → privacy/retention issue. Add a storage sweep (enqueue a cleanup job or prefix-delete). |
| **P1** | **CI pipeline** | No `.github/workflows`. Add one running `typecheck`, `lint`, `test` (+ integration against a throwaway Postgres) on PRs. |
| **P2** | Security headers / CSP | No custom headers. Add CSP, HSTS, `X-Content-Type-Options`, etc. |
| **P2** | Per-event cap is non-transactional | Small overshoot possible under concurrency; enforce in-DB if exactness matters. |

---

## UX improvements

| P | Item | Notes |
|---|------|-------|
| ~~P1~~ ✅ | **Publish/onboarding nudge** | **Shipped.** `EventStatusBanner` on every event tab when not Active — Draft gets a one-click "Publish now" (`publishEventAction`), Closed links to Settings. |
| **P2** | Moderation bulk-select-all + keyboard shortcuts | Load-more shipped with the P0 bug; faster-scanning ergonomics remain. |
| **P2** | `next/image` for galleries | Currently raw `<img>` everywhere (LCP/bandwidth). Needs `remotePatterns` for R2; signed-URL churn complicates caching — evaluate. |
| **P2** | Guest "finish later" polish + clearer per-file error messaging | The flow exists; tighten copy and retry affordances. |
| **P2** | Single-item / selected-items download (not just full ZIP export) | Common photographer ask. |
| **P2** | Dashboard empty/loading polish on remaining tabs | Overview/Settings fetch fast but could still get skeletons. |

---

## Performance improvements

| P | Item | Notes |
|---|------|-------|
| **P1** | **Worker throughput** | Single process, one job at a time. A big event creates a processing backlog (thumbnails lag). Add bounded concurrency and/or horizontal worker scaling (the DB queue + `SKIP LOCKED` already supports multiple workers). |
| **P2** | Keyset (cursor) pagination for the gallery | Offset pagination degrades on large events. |
| **P2** | Batch/cache presigned URLs | Each grid item is presigned individually per render; batch or cache to cut signing overhead. |
| **P2** | Parallelize export streaming | Sequential by design (safe/bounded memory); could parallelize with a bounded pool for very large events. |

---

## AI-ready groundwork

The product (guest photos at scale) is a strong fit for AI. Groundwork to lay
now so features slot in later — mostly seams, not features:

| P | Item | Notes |
|---|------|-------|
| **P1** | **Auto-moderation seam (trust & safety)** | A public guest-upload tool will receive inappropriate content. The worker already processes every upload and the schema models decisions (`moderation_status`, `moderation_actions`). Add a processing hook + a `system`/`auto` actor + a confidence/label field so an NSFW/quality classifier can pre-flag uploads for the photographer. Highest-value AI for going public. |
| **P2** | **`media_insights` store (labels/embeddings)** | Persist derived ML metadata (tags, faces, quality, embeddings) — a jsonb column or side table; consider `pgvector` for similarity/search. `uploads.metadata` jsonb already exists as a starting point. |
| **P2** | **Pluggable worker "processors"** | Refactor `lib/jobs/process-upload.ts` so steps (thumbnail, EXIF, future: tagging, dedup, quality) are a pipeline of processors — keeps AI additions isolated + idempotent. |
| **P2** | Auto-curation / highlights | Use quality + dedup signals to suggest a "best of" album. Depends on the insights store. |
| **P2** | Natural-language / visual search over an event | Depends on embeddings (`pgvector`). |

---

## Optional features (after MVP)

| P | Item | Notes |
|---|------|-------|
| **P0\*** | **Billing / subscriptions (Stripe)** | \*Not a fix, but a prerequisite to *charge*. Plans, limits, checkout, webhooks. |
| **P1** | Email notifications | "Uploads received", "export ready", "QR scanned" (Resend or similar). |
| **P2** | Shareable approved-gallery link for clients (expiring) | Deliver the gallery, not just a ZIP. |
| **P2** | Cover image selection | `setEventCover` exists but is unwired. |
| **P2** | Per-table / multiple QR codes per event + scan analytics | Schema supports multiple QR rows; `incrementQrScan` exists but is unwired. |
| **P2** | Watermarking / branding / white-label | Photographer branding on the guest page + exports. |
| **P2** | Teams / multiple photographers per account | Schema currently 1 photographer ↔ events. |
| **P2** | Admin / analytics UI | Analytics is CLI-only (`npm run analytics:summary`) today. |

---

## Technical debt created by MVP shortcuts

- **In-memory rate limiter** — needs a shared store for multi-instance.
- **Pagination shortcuts** — gallery uses offset; moderation has none.
- **Presign-per-item** — no batching/caching of signed URLs.
- **Worker** — single process, sequential, runs TS via `tsx` at runtime (no compiled
  build; image ships dev deps). Fine for pilot, revisit for scale.
- **R2 cleanup deferred** — relies on lifecycle rules; event-delete leaves orphans.
- **Per-event cap non-transactional** — small overshoot possible.
- **Unwired scaffolding** — `setEventCover`, `incrementQrScan`, `listQrCodesByEvent`.
- **No CI, no error monitoring, no health endpoint.**
- **Prototype/design-system routes ship publicly** (`/prototype/*`, `/design-system`).
- **Integration/E2E tests don't run in CI** (need a DB / secrets / browsers).
- **Analytics is CLI-only** (no dashboard).

---

## What MUST be fixed before charging customers

These are the bar for taking money:

1. **Rotate exposed secrets** (P0 hardening).
2. **R2 private + CORS + lifecycle rules** (P0 hardening) — cost + abandoned uploads.
3. **DB + R2 backups, restore tested** (P0 hardening) — you're now custodian of
   irreplaceable wedding media.
4. **Moderation pagination** (P0 bug) — the core flow breaks past 50 uploads.
5. **HEIC verified end-to-end on the worker** (P0 bug) — iPhone is the default camera.
6. **Worker hosted + monitored** (it's the backbone; if it's down, nothing processes
   and exports never complete). A heartbeat + `GET /api/health` now exist — point an
   uptime monitor at it. Still add app error monitoring (e.g. Sentry).
7. **Decide & implement event-delete data semantics** (P1, P0 if you promise deletion).
8. **Billing** to actually charge (Stripe) — prerequisite, not a fix.

## What can wait until after the first ~10 paying users

- Shared rate-limit store (per-event DB caps protect you at low volume).
- CI pipeline (run checks locally meanwhile).
- `next/image`, keyset pagination, presign batching, export parallelization.
- Worker concurrency/horizontal scaling (until a single event backlogs).
- All AI groundwork and AI features (except keep the auto-moderation seam in mind
  if you go fully public/unvetted early).
- Optional features: notifications, cover image, multi-QR + scan analytics,
  watermarking, teams, shareable client galleries, admin/analytics UI.

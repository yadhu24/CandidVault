# Security & Abuse-Prevention Review

Scope: the guest **upload** flow (public, unauthenticated) and the photographer
**dashboard/export** flow (authenticated). This documents the current posture,
what this hardening pass changed, what is mitigated now, and what still needs
manual infrastructure or future work. It deliberately avoids over-claiming —
where a control is best-effort, it says so.

---

## 1. Review summary

The codebase already followed most of CLAUDE.md §7/§12: identity is always
derived from the Supabase session (never request bodies), every photographer-
scoped resource is ownership-checked, all SQL is parameterized, object keys are
server-generated and event-namespaced, guests upload via short-lived presigned
URLs (the app never proxies media), and errors return a stable envelope with no
internals leaked. Upload tickets are HMAC-signed so the browser can never
fabricate the key/event/limits it confirms against.

This pass closed the remaining concrete gaps:

| # | Gap found | Change |
|---|-----------|--------|
| 1 | **No per-event upload cap** — a single event could accumulate unbounded rows/storage even with the IP limiter in place. | Added per-event count + total-bytes caps, enforced at presign (fast fail) and re-checked against real bytes at confirm (authoritative). |
| 2 | **Rate-limit key was spoofable** — `clientIp` used the leftmost `X-Forwarded-For`, which the client controls (a fresh bucket per request). | Prefer a trusted single-value header (`x-real-ip` / `cf-connecting-ip`, or `TRUSTED_IP_HEADER`); XFF is last-resort only, with the caveat documented. |
| 3 | **Unbounded `parts` array** in the multipart confirm schema. | Capped at 1000 entries (far above what the 500 MB file ceiling needs). |
| 4 | **No brake on export requests** — an expensive worker+R2 job, only guarded per-event. | Added a per-user rate limit (20/min) on `requestExportAction`. |
| 5 | **Retried confirms weren't fully idempotent** — a re-sent multipart confirm tried to re-complete a now-gone upload and failed. | Confirm now short-circuits on an already-registered storage key, returning the existing row. |
| 6 | Defense-in-depth on the (already signed) ticket key. | Confirm + parts assert the key lives under the resolved event's prefix (`isKeyForEvent`). |

All changes are additive/reversible and keep the existing response shapes.

---

## 2. Posture by focus area

### Public upload endpoint abuse
- **Before:** all three public endpoints (`upload-sessions`, `upload-parts`,
  `uploads`) were already IP rate-limited and required a signed ticket; bytes
  and content-type are re-validated against the real object at confirm.
- **Now:** also bounded by a **per-event hard cap** (count + total bytes) that is
  independent of IP, so even a distributed/spoofed flood cannot grow one event
  without bound. Presign fails fast (before creating a guest session or R2
  multipart upload); confirm is the authoritative check against real bytes.

### Rate limiting strategy
- Fixed-window, in-memory limiter on the public write endpoints
  (presign 30/min, parts 120/min, confirm 60/min per IP) plus export 20/min per
  user. **It is per-process** — see §3; treat it as a brake, not a guarantee.
- IP derivation hardened against `X-Forwarded-For` spoofing (gap #2).

### Per-event upload caps
- New: `lib/uploads/event-caps.ts`. Defaults: **10,000 uploads** and **100 GB**
  per event; override via `UPLOAD_MAX_PER_EVENT` /
  `UPLOAD_MAX_BYTES_PER_EVENT_GB`. The decision (`evaluateUploadCap`) is a pure
  function for easy testing.

### Invalid event access
- `resolvePublicEvent` returns `not_found` / `inactive(reason)`; the public page
  and APIs map these to friendly 404/403 responses. Uploads are accepted only
  when the event is `active` and its QR link isn't revoked.

### Cross-event access tampering
- Upload tickets bind `eventId` + `key`; every public endpoint re-resolves the
  event from the URL slug and requires `resolution.event.id === ticket.eventId`.
- Dashboard reads/writes go through `getEventByIdForPhotographer(id, user.id)` —
  ownership is in the SQL predicate, so a crafted `eventId`/`uploadId` returns
  "not found", never another tenant's data. Moderation/album mutations carry
  `event_id` in the `WHERE` clause too.
- Added prefix assertion (gap #6) as belt-and-suspenders against a signing bug.

### Raw object access leakage
- Buckets are private; the only way bytes leave R2 is a **short-lived (15 min)
  presigned GET**. Storage keys are **never** sent to the client — galleries and
  the moderation queue presign thumbnails server-side; the export download route
  redirects to a freshly-minted signed URL per click. Keys are server-generated
  UUIDs namespaced by event (no path traversal, no guest-chosen keys).

### Validation hardening on all APIs
- Every public/body endpoint validates with Zod before touching DB/storage
  (`CreateUploadSessionSchema`, `PresignPartsSchema`, `ConfirmUploadSchema`).
  Server actions validate too (events, profile, moderation decisions whitelisted,
  bulk size capped at 200). Closed the unbounded `parts` array (gap #3).

### Safe error messages
- One envelope: `{ error: { code, message } }` with stable codes and generic,
  human messages. Catches log only `err.name` (never the message/stack, never
  secrets/PII). No SQL, stack traces, or internal IDs reach clients.

### Dashboard auth / authorization
- Middleware refreshes the Supabase session on every matched path. Server
  components/actions/route handlers gate on `requirePhotographer()` →
  `requireAuth()` (which revalidates the JWT via `getUser()`), then ownership-
  check the specific resource. Identity is never taken from form/query/body.

### Export endpoint protection
- Request (server action) and download (route) both re-check ownership. Download
  refuses non-ready/expired exports and signs a fresh URL each time. Concurrency
  is bounded per event (in-flight guard) and now per user (gap #4).

---

## 3. What still needs manual infra or future work

These are **out of application code** or larger follow-ups. None are silently
assumed to be done.

1. **Shared rate-limit store (required for production scale).** The limiter is
   in-memory and per-process; on Vercel/serverless or multi-instance it does
   *not* enforce a global limit. Back it with Redis/Upstash/Cloudflare KV (or
   Durable Objects) before relying on it. *Mitigation today:* the per-event caps
   are DB-backed and global, so the hard abuse ceiling holds regardless.

2. **R2 bucket must be private + lifecycle rules.** Confirm no public access /
   no public `r2.dev` domain for the bucket. Add lifecycle rules to (a) abort
   incomplete multipart uploads (abandoned guest uploads) after ~1 day, and
   (b) expire `events/*/exports/*.zip` after the retention window
   (see `docs/exports.md`). Configure CORS to allow `PUT`/`GET`/`HEAD` only from
   the app origin.

3. **Edge/WAF rate limiting & bot protection** for the public routes
   (`/e/[slug]`, the upload APIs) — Vercel WAF / Cloudflare rules give an
   IP/ASN/bot brake before requests reach app code. Recommended complement to
   the in-app limiter.

4. **Set `TRUSTED_IP_HEADER` to match the deployment edge** so IP limiting keys
   on a non-spoofable value (e.g. `cf-connecting-ip` behind Cloudflare).

5. **Cap enforcement is not transactional.** Count-then-check has a small TOCTOU
   window, so the per-event cap can be exceeded by a few items under heavy
   concurrency. For an exact ceiling, enforce in the DB (a per-event counter row
   updated under lock, or a trigger/constraint). Acceptable for MVP.

6. **Database defense-in-depth.** The app connects as the table owner and so
   bypasses the RLS enabled in migration 0003. RLS is a backstop for *other*
   clients (e.g. a leaked anon key hitting PostgREST); it is not the app's
   primary authz, which is the ownership checks above. Keep the service-role key
   server-only and rotate any secret that has ever appeared in a chat/log
   (DB password, R2 keys, `UPLOAD_SIGNING_SECRET`).

7. **Rotate `UPLOAD_SIGNING_SECRET` carefully.** Rotating invalidates in-flight
   tickets (≤30 min TTL), which is fine; just don't log it.

8. **Test harness.** There is currently no test runner wired up. The new pure
   functions (`evaluateUploadCap`, ticket sign/verify, key builders) are written
   to be unit-testable; adding Vitest + tests for the authz/validation/cap logic
   is the highest-value next step (CLAUDE.md §8). Not added here to avoid an
   uninvited dependency/infra change.

---

## 4. Non-security observation (out of scope)

`updateEventStatus` / `setQrActive` exist in the data layer but aren't wired to
any UI, and `createEvent` defaults new events to `draft`. Since
`resolvePublicEvent` only accepts uploads for `active` events, the guest flow is
currently unreachable end-to-end until a publish/activate control is added. This
is a functional gap, not a vulnerability — flagged so it isn't mistaken for one.

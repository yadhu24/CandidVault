# ZIP Exports

How a photographer turns an event's **approved originals** into a single,
downloadable ZIP.

## Architecture

Like upload processing, the export queue **is a table** — the `exports` table —
not an external broker (CLAUDE.md §2/§14). A row with `status='pending'` is an
enqueued job. The same single background **worker** claims it, streams the ZIP,
and marks it ready/failed. Request (Server Action) and assembly (worker) are
fully separated.

```
PHOTOGRAPHER (browser)          APP SERVER                         R2              WORKER (separate process)
──────────────────────          ──────────                         ──              ─────────────────────────
"Request export" ───────────▶   requestExportAction()
                                  requirePhotographer + ownership
                                  guard: in-flight? approved=0?
                                  createExport() → exports row: status='pending'    (enqueue)
                                                                                    poll loop ▶ claimNextExport()
                                                                                      (UPDATE … FOR UPDATE SKIP LOCKED,
                                                                                       status='pending'→'processing')
                                                                                    ┌─ processExport(exp) ──────────────┐
                                                                                    │ list approved originals (no thumbs)│
                                                                                    │ archiver('zip', {store:true})      │
                                                                                    │ for each original:                 │
                                                                                    │   getObjectStream ◀──── R2         │
                                                                                    │   append → wait for 'entry'        │
                                                                                    │ pipe archive ─▶ multipart upload ─▶ R2 (exports/…zip)
                                                                                    └────────────────────────────────────┘
                                                                                    success ▶ markExportReady(key,size,count,expiresAt)
                                                                                    throw   ▶ deleteObject(partial) + markExportFailed
poll (router.refresh) ◀──────   /events/[id]/export server page reflects status
"Download" ─────────────────▶   /api/.../download → 302 → fresh presigned GET ────▶ browser downloads directly from R2
```

## Why streaming, not in-memory

Building a ZIP of an entire event could mean gigabytes. We never hold the
archive (or even a whole source file) in memory:

- **Each original is streamed** from R2 (`getObjectStream`) straight into the
  archive, **one at a time**. Only one source download is open at any moment, so
  we don't exhaust the SDK socket pool or hit idle timeouts on large events.
- **The archive output is piped** into a managed multipart upload
  (`@aws-sdk/lib-storage` `Upload`), which uploads parts as the stream flows.
  Peak memory is roughly one part buffer, independent of total ZIP size.
- **`store: true` (no compression).** Photos and videos are already compressed;
  deflate would burn CPU for ~0% gain.

**Tradeoff:** sequential streaming is simple and memory-safe but not parallel,
so a very large event takes longer to assemble. That's an acceptable MVP choice —
correctness and bounded resources over raw speed.

## Status & UI states

`exports.status` reuses the `processing_status` enum:

| status       | meaning                          | UI                                            |
| ------------ | -------------------------------- | --------------------------------------------- |
| `pending`    | queued, worker hasn't started    | "Queued…", request button disabled            |
| `processing` | worker is streaming the ZIP      | spinner + "Building…", page auto-polls         |
| `ready`      | ZIP in R2, `expires_at` set      | Download button (size + item count + expiry)  |
| `failed`     | error (incl. zero approved)      | error detail + Retry                          |

The export page is a server component; while an export is in-flight the client
panel calls `router.refresh()` on an interval so status updates without a manual
reload.

### Zero-approved case

Guarded twice: `requestExportAction` returns a friendly error if there are no
approved items (no row is created), and `processExport` also fails defensively
with `"No approved media to export"` if the set is empty by the time the worker
runs.

### Duplicate requests

`requestExportAction` checks `getInFlightExport`; if one is already
pending/processing it no-ops (returns ok) instead of queuing a second build.

## Security

- Identity and ownership come from the session (`requirePhotographer` +
  `getEventByIdForPhotographer` / `getOwnedEventOrNotFound`) on both the action
  and the download route.
- The final ZIP lives in the **private** bucket under
  `events/{eventId}/exports/{exportId}.zip`. The storage key is **never** sent
  to the client.
- Downloads go through `GET /api/events/[id]/exports/[exportId]/download`, which
  re-checks ownership, refuses non-ready or expired exports, then mints a
  **fresh, short-lived presigned GET** and 302-redirects to it. Every click gets
  a new signed, expiring URL; media never proxies through the app server.

## Retention & cleanup

Each export is given `expires_at = now() + 7 days`. The download route refuses to
sign anything past `expires_at` (returns `410`), so expired links die on their
own and the photographer is prompted to request a fresh export.

**The objects themselves are not deleted by the app.** Add an R2 **lifecycle
rule** to expire objects under the `exports/` key suffix after the same window
(7 days) so built ZIPs don't accumulate cost. This is intentional infra (not app
code) and must be configured once on the bucket:

- Scope: object key prefix matching the per-event exports path
  (`events/`) and/or the `/exports/` segment — match how your bucket is
  organized; the export keys are `events/{eventId}/exports/{exportId}.zip`.
- Action: expire (delete) current versions after 7 days.

If the retention window in `RETENTION_DAYS` (`lib/jobs/build-export.ts`) changes,
update the lifecycle rule to match.

Stale `processing` rows (a crashed worker) are swept to `failed` by
`recoverStaleExports` after 10 minutes. Exports are user-initiated, so we do
**not** auto-retry — the photographer simply requests again.

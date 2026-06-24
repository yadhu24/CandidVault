# Pilot Readiness

Practical checklists for running CandidVault with real photographers and guests.
Setup/deploy basics are in the [README](../README.md); this is the day-of and
go-live operational layer.

Quick mental model: **guest scans QR → uploads to R2 → photographer moderates →
exports a ZIP.** The **worker** must be running for thumbnails, video posters, and
exports. An event only accepts uploads when its status is **Active**.

---

## 1. Operator checklist — live event day

**Day before**
- [ ] Event created; date/venue/title correct on the Settings tab.
- [ ] Event status set to **Active** (Draft and Closed reject uploads).
- [ ] Open the public link yourself on a phone — confirm the upload page loads and
      shows the event name.
- [ ] Do one real test upload (photo **and** video) → confirm it lands in the
      Uploads (moderation) tab.
- [ ] Worker is running (check its logs show `[worker] started`).
- [ ] Print/share the QR (Download PNG on the overview) and/or copy the link.

**During the event**
- [ ] QR is visible/scannable where guests are (good lighting, not behind glass).
- [ ] Periodically glance at the Uploads tab — uploads are arriving.
- [ ] If guests report failures, see the [support checklist](#4-supportdebug-checklist--upload-failures).

**After the event**
- [ ] Moderate: approve/reject in the Uploads tab (bulk select works).
- [ ] Spot-check the Gallery (approved media renders with thumbnails).
- [ ] Request an export → wait for **Ready** → download the ZIP → verify it opens
      and contains the approved originals.
- [ ] When fully done collecting, set the event to **Closed** to stop new uploads.

---

## 2. Manual QA checklist

Run before each pilot on staging, then smoke-test on production. Note device +
network for each. "Pending in Uploads" means the row appears in the moderation
queue even before the worker has made a thumbnail.

### iPhone upload (Safari)
- [ ] Pick photos **and** a video from the camera roll (expect HEIC + .mov).
- [ ] Uploads complete → "N uploaded" success screen.
- [ ] Items show as Pending in Uploads; after the worker runs, thumbnails appear
      (HEIC also gets a viewable JPEG).

### Android upload (Chrome)
- [ ] Pick JPEG/PNG photos and an MP4 video.
- [ ] Same result: complete → Pending → thumbnails after the worker.

### Slow / flaky network
- [ ] Throttle (DevTools "Slow 3G") or use a weak real signal; upload a large video.
- [ ] Progress advances; on a dropped connection it **resumes** (doesn't restart
      from 0) and still completes.
- [ ] Leaving and reopening the page shows the "finish your upload" reminder for
      anything unfinished.

### Large file rejection
- [ ] Try an image **> 30 MB** and a video **> 500 MB**.
- [ ] Rejected with a clear "File is too large" message; **no** half-uploaded item
      appears in the moderation queue.

### Invalid event
- [ ] Open `/e/<made-up-slug>`.
- [ ] Friendly "this link doesn't look right" card — not a crash or raw 404.

### Closed event
- [ ] Set the event to **Closed** (or Draft) on Settings; open its public link.
- [ ] Shows "this event has closed / isn't open yet" — uploads are refused.

### Export path
- [ ] Approve a few items → Export tab → **Request export**.
- [ ] Status moves Pending → Building → **Ready** (worker must be running).
- [ ] **Download** works (fresh signed link) and the ZIP contains the approved
      originals. (A new request while one is building does not double-queue.)

---

## 3. Support / debug checklist — upload failures

Most guest-side failures are R2 configuration. Work top to bottom.

| Symptom | Likely cause | Check / fix |
|---|---|---|
| Console: `Missing ETag — check R2 CORS ExposeHeaders` | R2 CORS missing `ExposeHeaders: ETag` | Add it to the bucket CORS (required for multipart). |
| Browser CORS error on the `PUT` to R2 | CORS origins/methods | Allow `PUT`/`GET`/`HEAD` from the app origin (and `http://localhost:3000` for dev). |
| Stuck on "finalizing", then `UPLOAD_REJECTED` (422) | multipart assembly or real bytes ≠ declared type/size | Have the guest retry; check the upload's `upload_failed` reason in analytics. |
| `429 RATE_LIMITED` | per-IP limit (presign 30/min, parts 120/min, confirm 60/min) | Usually a single user retrying hard, or shared NAT; see "in-memory limiter" in [known limitations](#6-known-limitations). |
| `409 EVENT_UPLOAD_LIMIT` | per-event cap hit (default 10k files / 100 GB) | Raise `UPLOAD_MAX_PER_EVENT` / `UPLOAD_MAX_BYTES_PER_EVENT_GB`. |
| `403 EVENT_NOT_ACCEPTING_UPLOADS` | event not Active, or QR link revoked | Set status to Active on Settings. |
| "This link doesn't look right" | wrong/typo slug | Re-share the QR/link from the event overview. |
| Thumbnails never appear / export stuck "processing" | **worker not running** | Start `npm run worker`; check its logs. Stale exports auto-fail after ~10 min. |

**Where to look**
- Guest browser: console + network tab (the failing request + its response code).
- App logs: structured, keyed by error `code`.
- Worker logs: lines prefixed `[worker]` (per upload/export, with ok + detail).
- `npm run analytics:summary` → the **upload funnel** and `upload_failed` reasons
  (`file_too_large`, `cap_*`, `multipart_assembly`, `validation`, `object_missing`, …).
- DB: `uploads.status` / `uploads.processing_error`, `exports.status` / `error_detail`.

---

## 4. Bug triage template

Copy-paste per report:

```
Title:            <one line>
Severity:         P0 / P1 / P2 / P3
Environment:      production / staging
Flow:             guest upload / moderation / gallery / export / auth / other
Device + OS:      e.g. iPhone 14, iOS 17, Safari
Network:          wifi / 4G / weak
Event (slug/id):  <...>
Steps to repro:   1) … 2) … 3) …
Expected:         <...>
Actual:           <...>
Evidence:         console/network error code, screenshot, upload id, timestamp
Suspected area:   R2/CORS · worker · DB · auth · client · unknown
Workaround:       <if any>
```

**Severity guide**
- **P0** — guests can't upload at all, or data loss → fix now, consider pausing the event.
- **P1** — a core flow broken for many (exports fail, moderation broken) → same-day.
- **P2** — partial/edge breakage with a workaround → next release.
- **P3** — cosmetic / minor → backlog.

---

## 5. Known limitations

Be honest with pilot partners about these. Fuller detail in
[`security.md`](./security.md), [`exports.md`](./exports.md), and
[`testing.md`](./testing.md).

- **Worker is a single process.** No high-availability; if it's down, processing
  and exports pause. It's crash-safe (the DB queue resumes on restart, stale jobs
  self-heal), but run it on a host with auto-restart.
- **Rate limiter is in-memory, per-process.** On multi-instance/serverless it
  isn't a global limit. The DB-backed per-event caps are the real ceiling; add a
  shared store (Redis/Upstash) before high traffic.
- **Per-event cap isn't transactional** — under heavy concurrency it can be
  exceeded by a small margin. Fine for pilot scale.
- **Deleting an event leaves its R2 objects.** DB rows cascade; storage cleanup
  relies on lifecycle rules / a future sweep.
- **Video transcoding is optional.** Without `ffmpeg` on the worker, videos still
  upload and play but get a placeholder poster + no duration/dimensions.
- **No admin/analytics UI.** Analytics is the `npm run analytics:summary` CLI.
- **Signup needs email confirmation** (Supabase) before first login.
- **Prototype/design-system routes ship** (`/prototype/*`, `/design-system`) —
  harmless but public; gate or remove before a public launch.

---

## 6. Release checklist — staging → pilot

**Pre-deploy**
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all green.
- [ ] New migrations reviewed; understood what they change.
- [ ] All env vars set in **both** the app host and the **worker** host
      (`DATABASE_URL`, `R2_*`, `UPLOAD_SIGNING_SECRET`, Supabase keys,
      `NEXT_PUBLIC_APP_URL` = prod domain).
- [ ] R2 bucket is private; CORS (`PUT`/`GET`/`HEAD` + `ExposeHeaders: ETag`) and
      lifecycle rules in place.
- [ ] Any secret that appeared in chat/logs has been rotated.

**Deploy**
- [ ] Run `npm run db:migrate` against the production database.
- [ ] Deploy the app.
- [ ] Deploy/restart the worker; confirm `[worker] started` in its logs.

**Smoke test (staging first, then a real test event on prod)**
- [ ] Log in → create event → set Active.
- [ ] Open the public link on a phone → upload a photo + a video.
- [ ] Item appears in Uploads → thumbnail appears (worker working).
- [ ] Approve → it shows in Gallery.
- [ ] Request export → Ready → download → ZIP opens with the originals.

**Post-deploy**
- [ ] Worker logs clean; `npm run analytics:summary` shows events flowing.
- [ ] Delete the throwaway test event.
- [ ] Know your rollback: redeploy the previous build; migrations are
      forward-only, so avoid shipping a destructive migration with a pilot.

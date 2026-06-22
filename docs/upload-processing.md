# Upload Processing

How a confirmed guest upload becomes a processed, gallery-ready asset.

## Architecture

The job queue **is the `uploads` table** — no external broker (CLAUDE.md §2/§14).
A row with `status='pending'` is an enqueued job. The single background **worker**
claims rows atomically and processes them. Registration (API) and processing
(worker) are fully separated: the confirm endpoint only records the row.

```
GUEST (browser)                APP SERVER                     R2            WORKER (separate process)
──────────────                 ──────────                     ──            ─────────────────────────
presign  ───────────────────▶  issue presigned PUT  ─────────────────────▶
PUT bytes ─────────────────────────────────────────────────▶ (original)
confirm  ───────────────────▶  HEAD object, validate
                               registerUpload()  → uploads row: status='pending'   (enqueue)
                               returns safe fields ◀──┘
                                                              poll loop ▶ claimNextUpload()
                                                                          (UPDATE … FOR UPDATE SKIP LOCKED,
                                                                           status='pending'→'processing',
                                                                           processing_attempts += 1)
                                                              ┌─ processUpload(upload) ─────────────────┐
                                                              │ photo:                                    │
                                                              │   GetObject(original) ◀──── R2            │
                                                              │   sha256 → checksum                       │
                                                              │   sharp.metadata() → width/height         │
                                                              │   render thumbnail(480) + preview(1280)   │
                                                              │   PutObject(variant) ─────▶ R2            │
                                                              │   upsertUploadVariant(…)  (idempotent)    │
                                                              │ video:                                    │
                                                              │   placeholder — no decode, no thumbnail   │
                                                              └───────────────────────────────────────────┘
                                                              success ▶ markUploadReady(metadata)  status='ready'
                                                              throw   ▶ markUploadFailed(error)    status='failed'
```

Crash recovery: `recoverStaleProcessing()` requeues rows stuck in `processing`
past a timeout, or marks them `failed` once they hit `MAX_ATTEMPTS`.

## Modules

| Concern | File |
| --- | --- |
| Worker loop (claim → process → recover, graceful shutdown) | `worker/index.ts` |
| Job payload types | `lib/jobs/types.ts` |
| Orchestrator (photo/video, idempotent) | `lib/jobs/process-upload.ts` |
| Image dims + webp variants (sharp, lazy/optional) | `lib/media/image.ts` |
| SHA-256 checksum | `lib/media/hash.ts` |
| Atomic claim / recover / ready / failed; variant upsert | `lib/db/queries/uploads.ts` |
| Download original / upload variant; deterministic variant key | `lib/storage/objects.ts`, `lib/storage/keys.ts` |
| Failure/retry columns | `migrations/0004_add_upload_processing_columns.sql` |

## Idempotency & retry-safety

- **Atomic claim** (`FOR UPDATE SKIP LOCKED`) — two workers never grab the same row.
- **Deterministic variant keys** (`events/{eventId}/variants/{uploadId}/{variant}.webp`)
  + **upsert on `(upload_id, variant)`** — re-running a job overwrites, never duplicates.
- **Failures are recorded** (`processing_error`, `processing_attempts`, `processed_at`),
  so a failed job is observable and re-runnable, not lost.
- Explicitly `failed` jobs are terminal (no auto-retry of a genuinely bad file);
  retry them with `processUploadById(id)` or by setting the row back to `pending`.

## Running the worker

```bash
npm run worker     # node --env-file-if-exists=.env --import tsx worker/index.ts
```

Needs `DATABASE_URL` and the R2 vars (`R2_*`). Run it as a long-lived process on
a small host (Railway / Render / Fly / a VM) — it is **not** a Vercel serverless
function. Multiple instances are safe (SKIP LOCKED).

## Gaps / manual infra

- **Video thumbnails + duration require `ffmpeg`** (not bundled). Today videos
  get a placeholder (no thumbnail, null duration); the gallery shows a generic
  video tile. Add an ffmpeg/ffprobe step in `processVideo` to extract a poster
  frame + duration.
- **`sharp` is a native module.** Installed as a dependency; if a host lacks the
  binary the worker degrades to "metadata only" (no thumbnails) rather than
  crashing. HEIC support depends on the platform's libvips build.
- **Variant downloads** for the gallery use presigned GET (`createDownloadPresignedUrl`)
  against the private bucket — wiring those into the gallery UI is separate work.
- **Zip export** worker (`exports` table) is a future, separate job kind.

// Background worker entry point.
//
// The job queue is the `uploads` table: rows with status='pending' are claimed
// atomically (claimNextUpload, FOR UPDATE SKIP LOCKED), processed, then marked
// ready/failed. This is the one separate process CandidVault runs (CLAUDE.md
// §2/§14) — no external broker. Imports from lib/ only, never from app/.
//
// Run with:  npm run worker   (loads .env if present, runs TS via tsx)

import { getDb } from '@/lib/db/client'
import {
  claimNextUpload,
  markUploadFailed,
  recoverStaleProcessing,
} from '@/lib/db/queries/uploads'
import { processUpload } from '@/lib/jobs/process-upload'

const IDLE_DELAY_MS = 3000 // pause between polls when the queue is empty
const STALE_MINUTES = 10 // a 'processing' row untouched this long = crashed job
const MAX_ATTEMPTS = 3 // cap automatic recovery of crashed jobs

let running = true

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Process every claimable upload until the queue drains or we're shutting down.
async function drainQueue(): Promise<void> {
  while (running) {
    const upload = await claimNextUpload()
    if (!upload) return

    // Safety net for a poison row that somehow outlived recovery.
    if (upload.processingAttempts > MAX_ATTEMPTS) {
      await markUploadFailed(upload.id, 'Exceeded max processing attempts')
      continue
    }

    const result = await processUpload(upload)
    console.log('[worker] processed', {
      uploadId: result.uploadId,
      mediaType: upload.mediaType,
      ok: result.ok,
      detail: result.detail,
    })
  }
}

async function runWorker(): Promise<void> {
  console.log('[worker] started — polling for uploads')
  while (running) {
    try {
      await recoverStaleProcessing(STALE_MINUTES, MAX_ATTEMPTS)
      await drainQueue()
    } catch (err) {
      // A loop-level failure (e.g. transient DB error) must not kill the worker;
      // log and retry on the next tick.
      console.error('[worker] loop error', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (!running) break
    await sleep(IDLE_DELAY_MS)
  }
  await getDb().end()
  console.log('[worker] stopped cleanly')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal} received — finishing current item, then exiting`)
    running = false
  })
}

runWorker().catch((err) => {
  console.error('[worker] fatal error', err)
  process.exit(1)
})

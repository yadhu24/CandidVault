// Background worker entry point.
//
// The job queue is the `uploads` table: rows with status='pending' are claimed
// atomically (claimNextUpload, FOR UPDATE SKIP LOCKED), processed, then marked
// ready/failed. This is the one separate process CandidVault runs (CLAUDE.md
// §2/§14) — no external broker. Imports from lib/ only, never from app/.
//
// Run with:  npm run worker   (loads .env if present, runs TS via tsx)

import { hostname } from 'node:os'
import { getDb } from '@/lib/db/client'
import { claimNextExport, recoverStaleExports } from '@/lib/db/queries/exports'
import { recordWorkerHeartbeat } from '@/lib/db/queries/health'
import {
  claimNextUpload,
  markUploadFailed,
  recoverStaleProcessing,
} from '@/lib/db/queries/uploads'
import { processExport } from '@/lib/jobs/build-export'
import { processUpload } from '@/lib/jobs/process-upload'

const IDLE_DELAY_MS = 3000 // pause between polls when the queue is empty
const STALE_MINUTES = 10 // a 'processing' row untouched this long = crashed job
const MAX_ATTEMPTS = 3 // cap automatic recovery of crashed jobs
const HEARTBEAT_MS = 15_000 // liveness ping cadence (read by /api/health)

// Identifies this worker instance in worker_heartbeats (so multiple workers can
// report independently). Override with WORKER_ID if hostname isn't stable.
const WORKER_ID = process.env.WORKER_ID || hostname() || 'worker'

let running = true

// Heartbeat on its own timer, independent of the job loop, so a long-running job
// (e.g. a big ZIP export) doesn't look like a dead worker. Native CPU work
// (sharp/ffmpeg) runs off the main thread, so this timer still fires.
async function beat(): Promise<void> {
  try {
    await recordWorkerHeartbeat(WORKER_ID, { pid: process.pid })
  } catch (err) {
    console.error('[worker] heartbeat failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

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

// Build every claimable ZIP export until the queue drains.
async function drainExports(): Promise<void> {
  while (running) {
    const exp = await claimNextExport()
    if (!exp) return
    const result = await processExport(exp)
    console.log('[worker] export', { exportId: exp.id, ok: result.ok, detail: result.detail })
  }
}

async function runWorker(): Promise<void> {
  console.log(`[worker] started (${WORKER_ID}) — polling for uploads + exports`)
  await beat()
  const heartbeat = setInterval(() => void beat(), HEARTBEAT_MS)
  try {
    while (running) {
      try {
        await recoverStaleProcessing(STALE_MINUTES, MAX_ATTEMPTS)
        await drainQueue()
        await recoverStaleExports(STALE_MINUTES)
        await drainExports()
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
  } finally {
    clearInterval(heartbeat)
    await getDb().end()
  }
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

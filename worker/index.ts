// Background worker entry point.
// Polls for pending jobs and dispatches to handlers.
// Runs as a separate process; imports from lib/ only, never from app/.

import { generateThumbnailJob } from './jobs/generate-thumbnail'
import { extractMetadataJob } from './jobs/extract-metadata'
import { buildZipJob } from './jobs/build-zip'

async function runWorker() {
  console.log('[worker] starting')
  // TODO: Replace with a real job queue (pg-boss, BullMQ, etc.) when needed.
  // For now, poll the DB for pending jobs.
}

runWorker().catch((err) => {
  console.error('[worker] fatal error', err)
  process.exit(1)
})

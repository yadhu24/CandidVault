import {
  getUploadById,
  markUploadFailed,
  markUploadReady,
  upsertUploadVariant,
  type ReadyResult,
} from '@/lib/db/queries/uploads'
import type { Upload } from '@/lib/db/types'
import {
  IMAGE_VARIANTS,
  imageProcessingAvailable,
  readImageDimensions,
  renderImageVariant,
  sha256,
} from '@/lib/media'
import { buildVariantObjectKey, getObjectBuffer, putObject } from '@/lib/storage'
import type { JobResult } from './types'

interface MediaOutcome {
  ready: ReadyResult
  detail: string
}

// Post-upload processing for one upload. Idempotent + retry-safe: variant object
// keys are deterministic and rows upsert on (upload_id, variant), so a re-run
// overwrites rather than duplicates. Any error is recorded against the row via
// markUploadFailed so the failure is observable and the row is never lost.
export async function processUpload(upload: Upload): Promise<JobResult> {
  try {
    const outcome =
      upload.mediaType === 'photo' ? await processImage(upload) : await processVideo(upload)
    await markUploadReady(upload.id, outcome.ready)
    return { ok: true, uploadId: upload.id, detail: outcome.detail }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error'
    await markUploadFailed(upload.id, message)
    return { ok: false, uploadId: upload.id, detail: message }
  }
}

// Convenience entry for manual reprocessing (CLI / admin) by id.
export async function processUploadById(id: string): Promise<JobResult> {
  const upload = await getUploadById(id)
  if (!upload) return { ok: false, uploadId: id, detail: 'upload not found' }
  return processUpload(upload)
}

async function processImage(upload: Upload): Promise<MediaOutcome> {
  const original = await getObjectBuffer(upload.storageKey)
  const checksum = sha256(original)
  const dimensions = await readImageDimensions(original)

  if (!(await imageProcessingAvailable())) {
    return {
      ready: {
        checksum,
        width: dimensions.width,
        height: dimensions.height,
        metadata: { processor: 'none', reason: 'image processing unavailable' },
      },
      detail: 'image: metadata only (sharp unavailable)',
    }
  }

  let made = 0
  for (const spec of IMAGE_VARIANTS) {
    const rendered = await renderImageVariant(original, spec)
    if (!rendered) continue
    const key = buildVariantObjectKey(upload.eventId, upload.id, rendered.variant, rendered.ext)
    await putObject(key, rendered.buffer, rendered.contentType)
    await upsertUploadVariant({
      uploadId: upload.id,
      variant: rendered.variant,
      storageKey: key,
      mimeType: rendered.contentType,
      width: rendered.width,
      height: rendered.height,
      fileSizeBytes: rendered.bytes,
    })
    made += 1
  }

  return {
    ready: {
      checksum,
      width: dimensions.width,
      height: dimensions.height,
      metadata: { processor: 'sharp', variants: made },
    },
    detail: `image: ${made} variant(s) generated`,
  }
}

// Placeholder strategy for video: we do not decode here. Real frame extraction
// and duration require ffmpeg (see docs/upload-processing.md). We keep the
// recorded mime/size, leave width/height/duration null, and generate no
// thumbnail variant — the gallery renders a generic video tile (play icon) for
// uploads without a thumbnail. A large video is also not downloaded just to
// hash it, so checksum stays whatever was stored (usually null).
async function processVideo(upload: Upload): Promise<MediaOutcome> {
  return {
    ready: {
      metadata: {
        processor: 'none',
        placeholder: 'video',
        note: 'thumbnail + duration require ffmpeg',
        bytes: upload.fileSizeBytes,
      },
    },
    detail: 'video: registered (placeholder, no thumbnail)',
  }
}

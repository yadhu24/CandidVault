import {
  getUploadById,
  markUploadFailed,
  markUploadReady,
  upsertUploadVariant,
  type ReadyResult,
} from '@/lib/db/queries/uploads'
import type { Upload } from '@/lib/db/types'
import {
  extractPosterFrame,
  ffmpegAvailable,
  imageProcessingAvailable,
  isHeicMime,
  probeVideo,
  readImageDimensions,
  renderImageVariant,
  sha256,
  variantsForImage,
  type VariantSpec,
} from '@/lib/media'
import {
  buildVariantObjectKey,
  createDownloadPresignedUrl,
  getObjectBuffer,
  putObject,
} from '@/lib/storage'
import type { JobResult } from './types'

interface MediaOutcome {
  ready: ReadyResult
  detail: string
}

// Poster frames decode to the same webp renditions as photos.
const POSTER_VARIANTS: VariantSpec[] = [
  { variant: 'thumbnail', maxEdge: 480, format: 'webp' },
  { variant: 'preview', maxEdge: 1280, format: 'webp' },
]

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

// Renders each spec from a decoded source buffer and persists the variant rows.
// Returns how many variants were written.
async function renderAndStore(
  upload: Upload,
  source: Buffer,
  specs: VariantSpec[],
): Promise<number> {
  let made = 0
  for (const spec of specs) {
    const rendered = await renderImageVariant(source, spec)
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
  return made
}

async function processImage(upload: Upload): Promise<MediaOutcome> {
  const original = await getObjectBuffer(upload.storageKey)
  const checksum = sha256(original)
  const dimensions = await readImageDimensions(original)
  const heic = isHeicMime(upload.mimeType)

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

  // For HEIC this includes a full-size JPEG ('web') so the photo is viewable in
  // any browser; previews/thumbnails are webp for everything.
  const made = await renderAndStore(upload, original, variantsForImage(upload.mimeType))

  return {
    ready: {
      checksum,
      width: dimensions.width,
      height: dimensions.height,
      metadata: { processor: 'sharp', variants: made, transcodedFromHeic: heic },
    },
    detail: `image: ${made} variant(s)${heic ? ' (HEIC → JPEG + webp)' : ''}`,
  }
}

// Video strategy: when ffmpeg is on the host we read duration/dimensions and
// extract a poster frame, then render the same webp thumbnail/preview as photos
// so video previews don't break. Without ffmpeg we fall back explicitly: keep
// the original, leave the row ready with transcode:'pending', and let the gallery
// show a generic video tile. A later run (once ffmpeg is installed) can
// reprocess via processUploadById. We never download the whole file — ffmpeg
// range-seeks a short-lived presigned GET URL.
async function processVideo(upload: Upload): Promise<MediaOutcome> {
  if (!(await ffmpegAvailable())) {
    return {
      ready: {
        metadata: {
          processor: 'none',
          transcode: 'pending',
          reason: 'ffmpeg unavailable',
          bytes: upload.fileSizeBytes,
        },
      },
      detail: 'video: queued fallback (no ffmpeg, no poster)',
    }
  }

  const sourceUrl = await createDownloadPresignedUrl(upload.storageKey)
  const probe = await probeVideo(sourceUrl).catch(() => ({
    durationSeconds: null,
    width: null,
    height: null,
  }))
  const seekAt = probe.durationSeconds && probe.durationSeconds > 2 ? 1 : 0

  let made = 0
  try {
    const poster = await extractPosterFrame(sourceUrl, seekAt)
    made = await renderAndStore(upload, poster, POSTER_VARIANTS)
  } catch {
    // Poster failed (codec/seek issue) — keep duration/dims; gallery uses the
    // generic video tile. Not a hard failure.
  }

  return {
    ready: {
      width: probe.width,
      height: probe.height,
      durationSeconds: probe.durationSeconds,
      metadata: { processor: 'ffmpeg', poster: made > 0 },
    },
    detail: made > 0 ? `video: poster + ${made} variant(s)` : 'video: metadata only (poster unavailable)',
  }
}

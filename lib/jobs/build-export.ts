import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import archiver from 'archiver'
import { track } from '@/lib/analytics/track'
import {
  markExportFailed,
  markExportReady,
} from '@/lib/db/queries/exports'
import { listApprovedOriginalsForExport } from '@/lib/db/queries/uploads'
import type { Export } from '@/lib/db/types'
import { deleteObject, headObject } from '@/lib/storage'
import { buildExportObjectKey } from '@/lib/storage/keys'
import { getObjectStream, uploadStream } from '@/lib/storage/stream'

// Built ZIPs live for this long; an R2 lifecycle rule should delete the exports/
// prefix after the same window (see docs). expires_at also gates the download.
const RETENTION_DAYS = 7

// Stable, collision-free entry name: a zero-padded index prefix guarantees
// uniqueness + order even when two guests upload "IMG_1234.jpg".
function entryName(index: number, originalFilename: string | null, mime: string): string {
  const prefix = String(index + 1).padStart(4, '0')
  const base = (originalFilename ?? '').split(/[\\/]/).pop() ?? ''
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120)
  if (safe) return `${prefix}-${safe}`
  const ext = mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin'
  return `${prefix}-media.${ext}`
}

// Assembles a ZIP of an event's approved originals.
//
// Streaming, not in-memory: each original is streamed from R2 into the archive
// one at a time, and the archive is piped straight into a multipart upload back
// to R2. Memory stays bounded to ~one part buffer regardless of total size, and
// only one source download is open at a time. `store` (no compression) is used
// because photos/videos are already compressed — deflate would burn CPU for ~0
// gain. Tradeoff: sequential streaming is simpler and safe but not parallel, so a
// very large event takes longer; that's an acceptable MVP choice.
export async function processExport(exp: Export): Promise<{ ok: boolean; detail: string }> {
  const zipKey = buildExportObjectKey(exp.eventId, exp.id)
  try {
    const originals = await listApprovedOriginalsForExport(exp.eventId)
    if (originals.length === 0) {
      await markExportFailed(exp.id, 'No approved media to export')
      return { ok: false, detail: 'no approved media' }
    }

    const archive = archiver('zip', { store: true })
    const passthrough = new PassThrough()
    archive.pipe(passthrough)

    // Surfaces any archive error into the awaits below instead of throwing async.
    const fatal = new Promise<never>((_, reject) => {
      archive.on('error', reject)
    })
    fatal.catch(() => {}) // avoid an unhandled rejection if it loses a race

    // Start consuming the archive output immediately (streaming upload).
    const uploadPromise = uploadStream(zipKey, passthrough, 'application/zip')

    for (let i = 0; i < originals.length; i++) {
      const o = originals[i]
      const source = await getObjectStream(o.storageKey)
      const entryDone = once(archive, 'entry') // resolves when this entry is written
      archive.append(source, { name: entryName(i, o.originalFilename, o.mimeType) })
      await Promise.race([entryDone, fatal])
    }

    await Promise.race([archive.finalize(), fatal])
    await uploadPromise

    const head = await headObject(zipKey)
    await markExportReady(exp.id, {
      storageKey: zipKey,
      fileSizeBytes: head?.contentLength ?? 0,
      itemCount: originals.length,
      expiresAt: new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString(),
    })
    // Worker runs outside the Next runtime, so track directly (no next/after).
    await track('export_completed', {
      eventId: exp.eventId,
      actorType: 'system',
      properties: { itemCount: originals.length, bytes: head?.contentLength ?? 0 },
    })
    return { ok: true, detail: `zipped ${originals.length} file(s)` }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    // Best-effort cleanup of any partial object so a retry starts clean.
    await deleteObject(zipKey).catch(() => {})
    await markExportFailed(exp.id, message)
    return { ok: false, detail: message }
  }
}

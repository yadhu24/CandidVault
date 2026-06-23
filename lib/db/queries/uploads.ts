import { type PageOptions, query, queryOne, resolvePage } from '../query'
import type {
  MediaType,
  ModerationStatus,
  ProcessingStatus,
  Upload,
  UploadVariant,
  UploadVariantKind,
} from '../types'

export interface CreateUploadInput {
  eventId: string
  storageKey: string
  mediaType: MediaType
  mimeType: string
  fileSizeBytes: number
  guestSessionId?: string | null
  uploaderName?: string | null
  originalFilename?: string | null
  checksum?: string | null
}

export async function createUpload(input: CreateUploadInput): Promise<Upload> {
  const row = await queryOne<Upload>(
    `INSERT INTO uploads
       (event_id, guest_session_id, uploader_name, media_type, mime_type,
        file_size_bytes, storage_key, original_filename, checksum)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.eventId,
      input.guestSessionId ?? null,
      input.uploaderName ?? null,
      input.mediaType,
      input.mimeType,
      input.fileSizeBytes,
      input.storageKey,
      input.originalFilename ?? null,
      input.checksum ?? null,
    ],
  )
  return row as Upload
}

export interface RegisterUploadInput {
  eventId: string
  storageKey: string
  mediaType: MediaType
  mimeType: string
  fileSizeBytes: number
  guestSessionId: string | null
  uploaderName: string | null
  originalFilename: string | null
}

// Records a completed upload. status + moderation_status fall to their schema
// defaults ('pending') — uploads always start awaiting processing + moderation
// (requirement 6). Idempotent on storage_key so a retried confirmation returns
// the same row instead of failing.
export async function registerUpload(input: RegisterUploadInput): Promise<Upload> {
  const row = await queryOne<Upload>(
    `INSERT INTO uploads
       (event_id, guest_session_id, uploader_name, media_type, mime_type,
        file_size_bytes, storage_key, original_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (storage_key) DO UPDATE SET storage_key = uploads.storage_key
     RETURNING *`,
    [
      input.eventId,
      input.guestSessionId,
      input.uploaderName,
      input.mediaType,
      input.mimeType,
      input.fileSizeBytes,
      input.storageKey,
      input.originalFilename,
    ],
  )
  return row as Upload
}

export function getUploadById(id: string): Promise<Upload | null> {
  return queryOne<Upload>(`SELECT * FROM uploads WHERE id = $1`, [id])
}

export interface ListUploadsOptions extends PageOptions {
  moderationStatus?: ModerationStatus
}

export function listUploadsByEvent(
  eventId: string,
  opts: ListUploadsOptions = {},
): Promise<Upload[]> {
  const { limit, offset } = resolvePage(opts)
  if (opts.moderationStatus) {
    return query<Upload>(
      `SELECT * FROM uploads
       WHERE event_id = $1 AND moderation_status = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [eventId, opts.moderationStatus, limit, offset],
    )
  }
  return query<Upload>(
    `SELECT * FROM uploads
     WHERE event_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [eventId, limit, offset],
  )
}

export interface ModerationUpload extends Upload {
  thumbnailKey: string | null
}

export interface ListModerationOptions extends PageOptions {
  moderationStatus: ModerationStatus
  mediaType?: MediaType
}

// Moderation queue feed: an event's uploads in one status, optionally one media
// type, each joined to its thumbnail variant key (null until the worker has made
// one). Storage keys stay server-side — the page presigns the thumbnail.
export function listUploadsForModeration(
  eventId: string,
  opts: ListModerationOptions,
): Promise<ModerationUpload[]> {
  const { limit, offset } = resolvePage(opts)
  const params: unknown[] = [eventId, opts.moderationStatus, limit, offset]
  let typeClause = ''
  if (opts.mediaType) {
    params.push(opts.mediaType)
    typeClause = ` AND u.media_type = $5`
  }
  return query<ModerationUpload>(
    `SELECT u.*, v.storage_key AS thumbnail_key
     FROM uploads u
     LEFT JOIN upload_variants v ON v.upload_id = u.id AND v.variant = 'thumbnail'
     WHERE u.event_id = $1 AND u.moderation_status = $2${typeClause}
     ORDER BY u.created_at DESC
     LIMIT $3 OFFSET $4`,
    params,
  )
}

export interface GalleryUpload extends Upload {
  thumbnailKey: string | null
  previewKey: string | null
  webKey: string | null
}

export interface ListApprovedOptions extends PageOptions {
  mediaType?: MediaType
  sort?: 'newest' | 'oldest'
  favoritesOnly?: boolean
}

// Approved gallery feed: one row per approved upload with its thumbnail/preview/
// web variant keys folded in via a single aggregating join (GROUP BY the PK).
// Storage keys stay server-side; the caller presigns. Ordered by capture/upload
// time; paginated via limit/offset.
export function listApprovedUploads(
  eventId: string,
  opts: ListApprovedOptions = {},
): Promise<GalleryUpload[]> {
  const { limit, offset } = resolvePage(opts)
  const order = opts.sort === 'oldest' ? 'ASC' : 'DESC' // fixed literals, never user input
  const params: unknown[] = [eventId, limit, offset]
  let typeClause = ''
  if (opts.mediaType) {
    params.push(opts.mediaType)
    typeClause = ` AND u.media_type = $4`
  }
  const favClause = opts.favoritesOnly ? ' AND u.is_favorite' : ''
  return query<GalleryUpload>(
    `SELECT u.*,
       MAX(CASE WHEN v.variant = 'thumbnail' THEN v.storage_key END) AS thumbnail_key,
       MAX(CASE WHEN v.variant = 'preview'   THEN v.storage_key END) AS preview_key,
       MAX(CASE WHEN v.variant = 'web'       THEN v.storage_key END) AS web_key
     FROM uploads u
     LEFT JOIN upload_variants v ON v.upload_id = u.id
     WHERE u.event_id = $1 AND u.moderation_status = 'approved'${typeClause}${favClause}
     GROUP BY u.id
     ORDER BY u.created_at ${order}
     LIMIT $2 OFFSET $3`,
    params,
  )
}

// Event-scoped favorite toggle. event_id in the predicate prevents touching an
// upload from another event even with a crafted id. Returns null if not found.
export function setUploadFavorite(
  uploadId: string,
  eventId: string,
  favorite: boolean,
): Promise<Upload | null> {
  return queryOne<Upload>(
    `UPDATE uploads SET is_favorite = $3 WHERE id = $1 AND event_id = $2 RETURNING *`,
    [uploadId, eventId, favorite],
  )
}

export interface ExportSource {
  id: string
  storageKey: string
  originalFilename: string | null
  mimeType: string
}

// All approved originals for an event, oldest first — the source list for a ZIP
// export. No pagination: the export job streams every one. Storage keys stay
// server-side (worker reads them directly).
export function listApprovedOriginalsForExport(eventId: string): Promise<ExportSource[]> {
  return query<ExportSource>(
    `SELECT id, storage_key, original_filename, mime_type
     FROM uploads
     WHERE event_id = $1 AND moderation_status = 'approved'
     ORDER BY created_at`,
    [eventId],
  )
}

// Worker: claim unfinished media. Backed by the partial index
// idx_uploads_pending_processing so it stays cheap as the table grows.
export function listPendingProcessing(limit = 20): Promise<Upload[]> {
  return query<Upload>(
    `SELECT * FROM uploads
     WHERE status IN ('pending', 'processing')
     ORDER BY created_at
     LIMIT $1`,
    [limit],
  )
}

export interface ProcessingResult {
  status: ProcessingStatus
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  capturedAt?: string | null
  metadata?: Record<string, unknown> | null
}

export function updateUploadProcessing(
  id: string,
  result: ProcessingResult,
): Promise<Upload | null> {
  return queryOne<Upload>(
    `UPDATE uploads SET
       status = $2,
       width = $3,
       height = $4,
       duration_seconds = $5,
       captured_at = $6,
       metadata = $7
     WHERE id = $1
     RETURNING *`,
    [
      id,
      result.status,
      result.width ?? null,
      result.height ?? null,
      result.durationSeconds ?? null,
      result.capturedAt ?? null,
      result.metadata ?? null,
    ],
  )
}

// --- Worker job lifecycle -------------------------------------------------

// Atomically claims the oldest pending upload for processing. FOR UPDATE SKIP
// LOCKED lets multiple workers run concurrently without ever grabbing the same
// row, and the attempt counter caps retries / supports stale-job recovery.
// Returns null when the queue is empty.
export function claimNextUpload(): Promise<Upload | null> {
  return queryOne<Upload>(
    `UPDATE uploads
     SET status = 'processing', processing_attempts = processing_attempts + 1
     WHERE id = (
       SELECT id FROM uploads
       WHERE status = 'pending'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
  )
}

// Recovers jobs left in 'processing' by a crashed worker: those untouched for
// `staleMinutes` are requeued, or marked failed once they reach `maxAttempts`.
// Returns how many rows were recovered.
export async function recoverStaleProcessing(
  staleMinutes: number,
  maxAttempts: number,
): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE uploads
     SET status = CASE WHEN processing_attempts >= $2 THEN 'failed' ELSE 'pending' END,
         processing_error = CASE WHEN processing_attempts >= $2
           THEN 'Processing did not complete after repeated attempts'
           ELSE processing_error END,
         processed_at = CASE WHEN processing_attempts >= $2 THEN now() ELSE processed_at END
     WHERE status = 'processing'
       AND updated_at < now() - make_interval(mins => $1)
     RETURNING id`,
    [staleMinutes, maxAttempts],
  )
  return rows.length
}

export interface ReadyResult {
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  capturedAt?: string | null
  checksum?: string | null
  metadata?: Record<string, unknown> | null
}

// Success path: persist extracted metadata, clear any prior error, mark ready.
// checksum is COALESCEd so a media type we don't hash (e.g. a large video) keeps
// any value already stored rather than nulling it.
export function markUploadReady(id: string, result: ReadyResult): Promise<Upload | null> {
  return queryOne<Upload>(
    `UPDATE uploads SET
       status = 'ready',
       width = $2,
       height = $3,
       duration_seconds = $4,
       captured_at = $5,
       checksum = COALESCE($6, checksum),
       metadata = $7,
       processing_error = NULL,
       processed_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      result.width ?? null,
      result.height ?? null,
      result.durationSeconds ?? null,
      result.capturedAt ?? null,
      result.checksum ?? null,
      result.metadata ?? null,
    ],
  )
}

// Failure path: record the error against the job so it stays observable and
// retryable rather than lost. Capped to keep the column bounded.
export function markUploadFailed(id: string, error: string): Promise<Upload | null> {
  return queryOne<Upload>(
    `UPDATE uploads SET status = 'failed', processing_error = $2, processed_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, error.slice(0, 2000)],
  )
}

export interface UpsertVariantInput {
  uploadId: string
  variant: UploadVariantKind
  storageKey: string
  mimeType: string
  width?: number | null
  height?: number | null
  fileSizeBytes?: number | null
}

// Idempotent on (upload_id, variant): re-running a worker job overwrites the
// single row for that kind rather than duplicating it.
export async function upsertUploadVariant(input: UpsertVariantInput): Promise<UploadVariant> {
  const row = await queryOne<UploadVariant>(
    `INSERT INTO upload_variants
       (upload_id, variant, storage_key, mime_type, width, height, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (upload_id, variant) DO UPDATE SET
       storage_key = EXCLUDED.storage_key,
       mime_type = EXCLUDED.mime_type,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       file_size_bytes = EXCLUDED.file_size_bytes
     RETURNING *`,
    [
      input.uploadId,
      input.variant,
      input.storageKey,
      input.mimeType,
      input.width ?? null,
      input.height ?? null,
      input.fileSizeBytes ?? null,
    ],
  )
  return row as UploadVariant
}

export function listUploadVariants(uploadId: string): Promise<UploadVariant[]> {
  return query<UploadVariant>(`SELECT * FROM upload_variants WHERE upload_id = $1`, [uploadId])
}

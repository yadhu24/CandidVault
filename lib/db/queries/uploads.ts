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

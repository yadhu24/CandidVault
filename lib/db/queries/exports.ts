import { query, queryOne } from '../query'
import type { Export, ExportScope } from '../types'

export interface CreateExportInput {
  eventId: string
  requestedBy?: string | null
  scope?: ExportScope
  albumId?: string | null
}

export async function createExport(input: CreateExportInput): Promise<Export> {
  const row = await queryOne<Export>(
    `INSERT INTO exports (event_id, requested_by, scope, album_id)
     VALUES ($1, $2, COALESCE($3, 'all'), $4)
     RETURNING *`,
    [input.eventId, input.requestedBy ?? null, input.scope ?? null, input.albumId ?? null],
  )
  return row as Export
}

export function getExportById(id: string): Promise<Export | null> {
  return queryOne<Export>(`SELECT * FROM exports WHERE id = $1`, [id])
}

export function listExportsByEvent(eventId: string): Promise<Export[]> {
  return query<Export>(`SELECT * FROM exports WHERE event_id = $1 ORDER BY created_at DESC`, [
    eventId,
  ])
}

// Worker: claim unfinished exports. Backed by idx_exports_pending.
export function listPendingExports(limit = 5): Promise<Export[]> {
  return query<Export>(
    `SELECT * FROM exports
     WHERE status IN ('pending', 'processing')
     ORDER BY created_at
     LIMIT $1`,
    [limit],
  )
}

export function markExportProcessing(id: string): Promise<Export | null> {
  return queryOne<Export>(`UPDATE exports SET status = 'processing' WHERE id = $1 RETURNING *`, [
    id,
  ])
}

export interface ExportReadyInput {
  storageKey: string
  fileSizeBytes: number
  itemCount: number
  expiresAt?: string | null
}

export function markExportReady(id: string, result: ExportReadyInput): Promise<Export | null> {
  return queryOne<Export>(
    `UPDATE exports SET
       status = 'ready',
       storage_key = $2,
       file_size_bytes = $3,
       item_count = $4,
       expires_at = $5,
       error_detail = NULL
     WHERE id = $1
     RETURNING *`,
    [id, result.storageKey, result.fileSizeBytes, result.itemCount, result.expiresAt ?? null],
  )
}

export function markExportFailed(id: string, errorDetail: string): Promise<Export | null> {
  return queryOne<Export>(
    `UPDATE exports SET status = 'failed', error_detail = $2 WHERE id = $1 RETURNING *`,
    [id, errorDetail],
  )
}

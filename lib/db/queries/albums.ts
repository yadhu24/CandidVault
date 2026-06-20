import { query, queryOne } from '../query'
import type { Album, AlbumItem } from '../types'

export interface CreateAlbumInput {
  eventId: string
  name: string
  description?: string | null
  position?: number
}

export async function createAlbum(input: CreateAlbumInput): Promise<Album> {
  const row = await queryOne<Album>(
    `INSERT INTO albums (event_id, name, description, position)
     VALUES ($1, $2, $3, COALESCE($4, 0))
     RETURNING *`,
    [input.eventId, input.name, input.description ?? null, input.position ?? null],
  )
  return row as Album
}

export function getAlbumById(id: string): Promise<Album | null> {
  return queryOne<Album>(`SELECT * FROM albums WHERE id = $1`, [id])
}

export function listAlbumsByEvent(eventId: string): Promise<Album[]> {
  return query<Album>(`SELECT * FROM albums WHERE event_id = $1 ORDER BY position, created_at`, [
    eventId,
  ])
}

// Idempotent on (album_id, upload_id): adding an upload already in the album
// just updates its position.
export async function addAlbumItem(
  albumId: string,
  uploadId: string,
  position = 0,
): Promise<AlbumItem> {
  const row = await queryOne<AlbumItem>(
    `INSERT INTO album_items (album_id, upload_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (album_id, upload_id) DO UPDATE SET position = EXCLUDED.position
     RETURNING *`,
    [albumId, uploadId, position],
  )
  return row as AlbumItem
}

export async function removeAlbumItem(albumId: string, uploadId: string): Promise<void> {
  await query(`DELETE FROM album_items WHERE album_id = $1 AND upload_id = $2`, [albumId, uploadId])
}

export function listAlbumItems(albumId: string): Promise<AlbumItem[]> {
  return query<AlbumItem>(
    `SELECT * FROM album_items WHERE album_id = $1 ORDER BY position, created_at`,
    [albumId],
  )
}

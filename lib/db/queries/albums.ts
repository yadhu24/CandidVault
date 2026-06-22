import { query, queryOne, resolvePage, type PageOptions } from '../query'
import type { Album, AlbumItem } from '../types'
import type { GalleryUpload } from './uploads'

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

// Ownership-scoped fetch: returns null when the album doesn't exist or isn't in
// this event, so callers can treat both as "not found".
export function getAlbumForEvent(albumId: string, eventId: string): Promise<Album | null> {
  return queryOne<Album>(`SELECT * FROM albums WHERE id = $1 AND event_id = $2`, [albumId, eventId])
}

export interface AlbumWithMeta extends Album {
  itemCount: number
  coverThumbnailKey: string | null
}

// Album list for the event with an item count and a cover thumbnail (the first
// item's), so the Albums tab reads clearly at a glance.
export function listAlbumsWithMeta(eventId: string): Promise<AlbumWithMeta[]> {
  return query<AlbumWithMeta>(
    `SELECT a.*,
       (SELECT COUNT(*) FROM album_items ai WHERE ai.album_id = a.id)::int AS item_count,
       (SELECT v.storage_key
          FROM album_items ai
          JOIN upload_variants v ON v.upload_id = ai.upload_id AND v.variant = 'thumbnail'
          WHERE ai.album_id = a.id
          ORDER BY ai.position, ai.created_at
          LIMIT 1) AS cover_thumbnail_key
     FROM albums a
     WHERE a.event_id = $1
     ORDER BY a.position, a.created_at`,
    [eventId],
  )
}

// An album's media with thumbnail/preview/web variant keys folded in — same shape
// as the gallery feed, so it reuses the gallery serializer. Storage keys stay
// server-side.
export function listAlbumUploads(albumId: string, opts: PageOptions = {}): Promise<GalleryUpload[]> {
  const { limit, offset } = resolvePage(opts)
  return query<GalleryUpload>(
    `SELECT u.*,
       MAX(CASE WHEN v.variant = 'thumbnail' THEN v.storage_key END) AS thumbnail_key,
       MAX(CASE WHEN v.variant = 'preview'   THEN v.storage_key END) AS preview_key,
       MAX(CASE WHEN v.variant = 'web'       THEN v.storage_key END) AS web_key
     FROM album_items ai
     JOIN uploads u ON u.id = ai.upload_id
     LEFT JOIN upload_variants v ON v.upload_id = u.id
     WHERE ai.album_id = $1
     GROUP BY u.id, ai.position, ai.created_at
     ORDER BY ai.position, ai.created_at
     LIMIT $2 OFFSET $3`,
    [albumId, limit, offset],
  )
}

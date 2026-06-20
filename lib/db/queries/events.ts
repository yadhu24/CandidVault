import { type PageOptions, query, queryOne, resolvePage } from '../query'
import type { Event, EventQrCode, EventStatus } from '../types'

export interface CreateEventInput {
  photographerId: string
  slug: string
  name: string
  description?: string | null
  eventDate?: string | null
  status?: EventStatus
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const row = await queryOne<Event>(
    `INSERT INTO events (photographer_id, slug, name, description, event_date, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'draft'))
     RETURNING *`,
    [
      input.photographerId,
      input.slug,
      input.name,
      input.description ?? null,
      input.eventDate ?? null,
      input.status ?? null,
    ],
  )
  return row as Event
}

export function getEventById(id: string): Promise<Event | null> {
  return queryOne<Event>(`SELECT * FROM events WHERE id = $1`, [id])
}

export function getEventBySlug(slug: string): Promise<Event | null> {
  return queryOne<Event>(`SELECT * FROM events WHERE slug = $1`, [slug])
}

export function listEventsByPhotographer(
  photographerId: string,
  page?: PageOptions,
): Promise<Event[]> {
  const { limit, offset } = resolvePage(page)
  return query<Event>(
    `SELECT * FROM events
     WHERE photographer_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [photographerId, limit, offset],
  )
}

export function updateEventStatus(id: string, status: EventStatus): Promise<Event | null> {
  return queryOne<Event>(`UPDATE events SET status = $2 WHERE id = $1 RETURNING *`, [id, status])
}

export function setEventCover(id: string, coverUploadId: string | null): Promise<Event | null> {
  return queryOne<Event>(`UPDATE events SET cover_upload_id = $2 WHERE id = $1 RETURNING *`, [
    id,
    coverUploadId,
  ])
}

export interface CreateQrCodeInput {
  eventId: string
  token: string
  label?: string | null
}

export async function createQrCode(input: CreateQrCodeInput): Promise<EventQrCode> {
  const row = await queryOne<EventQrCode>(
    `INSERT INTO event_qr_codes (event_id, token, label)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.eventId, input.token, input.label ?? null],
  )
  return row as EventQrCode
}

export function getQrCodeByToken(token: string): Promise<EventQrCode | null> {
  return queryOne<EventQrCode>(`SELECT * FROM event_qr_codes WHERE token = $1`, [token])
}

export function listQrCodesByEvent(eventId: string): Promise<EventQrCode[]> {
  return query<EventQrCode>(
    `SELECT * FROM event_qr_codes WHERE event_id = $1 ORDER BY created_at`,
    [eventId],
  )
}

// Counter increment is a hot-row write under heavy scanning; see the scaling
// note in the PR before relying on this for real analytics.
export function incrementQrScan(id: string): Promise<EventQrCode | null> {
  return queryOne<EventQrCode>(
    `UPDATE event_qr_codes SET scan_count = scan_count + 1 WHERE id = $1 RETURNING *`,
    [id],
  )
}

export function setQrActive(id: string, isActive: boolean): Promise<EventQrCode | null> {
  return queryOne<EventQrCode>(
    `UPDATE event_qr_codes SET is_active = $2 WHERE id = $1 RETURNING *`,
    [id, isActive],
  )
}

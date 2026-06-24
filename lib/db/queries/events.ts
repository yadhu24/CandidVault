import { type PageOptions, query, queryOne, resolvePage } from '../query'
import type { Event, EventQrCode, EventStatus, EventType } from '../types'

export interface CreateEventInput {
  photographerId: string
  slug: string
  name: string
  eventType: EventType
  description?: string | null
  eventDate?: string | null
  venue?: string | null
  status?: EventStatus
}

export async function createEvent(input: CreateEventInput): Promise<Event> {
  const row = await queryOne<Event>(
    `INSERT INTO events (photographer_id, slug, name, event_type, description, event_date, venue, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'draft'))
     RETURNING *`,
    [
      input.photographerId,
      input.slug,
      input.name,
      input.eventType,
      input.description ?? null,
      input.eventDate ?? null,
      input.venue ?? null,
      input.status ?? null,
    ],
  )
  return row as Event
}

export function getEventById(id: string): Promise<Event | null> {
  return queryOne<Event>(`SELECT * FROM events WHERE id = $1`, [id])
}

// Ownership-scoped fetch: returns null when the event doesn't exist OR isn't
// owned by this photographer, so callers can treat both as "not found".
export function getEventByIdForPhotographer(
  id: string,
  photographerId: string,
): Promise<Event | null> {
  return queryOne<Event>(`SELECT * FROM events WHERE id = $1 AND photographer_id = $2`, [
    id,
    photographerId,
  ])
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

export interface UpdateEventFields {
  name: string
  eventType: EventType
  eventDate: string | null
  venue: string | null
  description: string | null
  status: EventStatus
}

// Ownership-scoped update: photographer_id is in the predicate so a crafted id
// can't edit another photographer's event (returns null when not owned).
export function updateEventForPhotographer(
  id: string,
  photographerId: string,
  fields: UpdateEventFields,
): Promise<Event | null> {
  return queryOne<Event>(
    `UPDATE events SET
       name = $3,
       event_type = $4,
       event_date = $5,
       venue = $6,
       description = $7,
       status = $8
     WHERE id = $1 AND photographer_id = $2
     RETURNING *`,
    [
      id,
      photographerId,
      fields.name,
      fields.eventType,
      fields.eventDate,
      fields.venue,
      fields.description,
      fields.status,
    ],
  )
}

// Ownership-scoped delete. Child rows (uploads, variants, albums, exports,
// analytics_events, …) are removed by ON DELETE CASCADE / SET NULL from the
// schema. Returns the deleted id, or null when the event wasn't owned/found.
// NOTE: this drops DB rows only — see lib/events/actions for the R2 cleanup gap.
export async function deleteEventForPhotographer(
  id: string,
  photographerId: string,
): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM events WHERE id = $1 AND photographer_id = $2 RETURNING id`,
    [id, photographerId],
  )
  return row?.id ?? null
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

// Idempotent: ensures the event has its (single, MVP) QR row. Token is the event
// slug — the public link resolves by slug, and slug uniqueness gives token
// uniqueness. The schema still allows multiple QR codes per event for later.
export async function ensureEventQrCode(eventId: string, token: string): Promise<EventQrCode> {
  const row = await queryOne<EventQrCode>(
    `INSERT INTO event_qr_codes (event_id, token)
     VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET token = event_qr_codes.token
     RETURNING *`,
    [eventId, token],
  )
  return row as EventQrCode
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

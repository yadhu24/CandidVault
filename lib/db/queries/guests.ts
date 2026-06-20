import { queryOne } from '../query'
import type { GuestSession } from '../types'

export interface CreateGuestSessionInput {
  eventId: string
  token: string
  qrCodeId?: string | null
  displayName?: string | null
}

export async function createGuestSession(input: CreateGuestSessionInput): Promise<GuestSession> {
  const row = await queryOne<GuestSession>(
    `INSERT INTO guest_sessions (event_id, qr_code_id, display_name, token)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.eventId, input.qrCodeId ?? null, input.displayName ?? null, input.token],
  )
  return row as GuestSession
}

export function getGuestSessionByToken(token: string): Promise<GuestSession | null> {
  return queryOne<GuestSession>(`SELECT * FROM guest_sessions WHERE token = $1`, [token])
}

export function touchGuestSession(id: string): Promise<GuestSession | null> {
  return queryOne<GuestSession>(
    `UPDATE guest_sessions SET last_seen_at = now() WHERE id = $1 RETURNING *`,
    [id],
  )
}

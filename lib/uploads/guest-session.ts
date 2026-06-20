import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import {
  createGuestSession,
  getGuestSessionByToken,
  touchGuestSession,
} from '@/lib/db/queries/guests'
import type { GuestSession } from '@/types'

// httpOnly so the opaque session token is never readable by client JS (XSS-safe);
// the browser never needs to read it — only the server resolves it.
const COOKIE_NAME = 'cv_guest_session'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

// Resolves the guest's session for this event from their cookie, creating one if
// absent or if the cookie belongs to a different event. This is how uploads get
// associated with a guest (requirement 7) without requiring an account.
export async function getOrCreateGuestSession(
  eventId: string,
  displayName?: string | null,
): Promise<GuestSession> {
  const jar = await cookies()
  const existingToken = jar.get(COOKIE_NAME)?.value

  if (existingToken) {
    const session = await getGuestSessionByToken(existingToken)
    if (session && session.eventId === eventId) {
      await touchGuestSession(session.id)
      return session
    }
  }

  const token = randomBytes(24).toString('base64url')
  const session = await createGuestSession({ eventId, token, displayName: displayName ?? null })
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return session
}

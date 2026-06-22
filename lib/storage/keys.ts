import { randomUUID } from 'node:crypto'
import { type AllowedMimeType, extForMime } from '@/lib/validation/media'

// Object keys are ALWAYS server-generated and namespaced by event (CLAUDE.md §7).
// Guests never choose a key; the original filename is kept in the DB for display
// only, never in the key — this avoids path traversal, collisions, and injection.
//
// Layout: events/{eventId}/originals/{objectId}.{ext}
export const ORIGINALS_SEGMENT = 'originals'

export function buildOriginalObjectKey(eventId: string, mime: AllowedMimeType): string {
  return `events/${eventId}/${ORIGINALS_SEGMENT}/${randomUUID()}.${extForMime(mime)}`
}

// Defensive shape check for a key we claim to have issued (used at confirm).
export function isOriginalObjectKey(key: string): boolean {
  return /^events\/[0-9a-f-]{36}\/originals\/[0-9a-f-]{36}\.[a-z0-9]+$/.test(key)
}

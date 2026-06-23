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

// Belt-and-suspenders: a signed ticket already binds the key to its event, but
// confirming routes also assert the key lives under the resolved event's prefix
// so a (hypothetical) signing bug could never let a ticket touch another event.
export function isKeyForEvent(key: string, eventId: string): boolean {
  return key.startsWith(`events/${eventId}/`)
}

export const EXPORTS_SEGMENT = 'exports'

// Deterministic per export id, so a retried export overwrites the same object.
// Layout: events/{eventId}/exports/{exportId}.zip
export function buildExportObjectKey(eventId: string, exportId: string): string {
  return `events/${eventId}/${EXPORTS_SEGMENT}/${exportId}.zip`
}

export const VARIANTS_SEGMENT = 'variants'

// Derived-rendition key. Deterministic per (upload, variant) so re-running a
// worker job overwrites the same object instead of orphaning a new one — this is
// what keeps variant generation idempotent under retries.
// Layout: events/{eventId}/variants/{uploadId}/{variant}.{ext}
export function buildVariantObjectKey(
  eventId: string,
  uploadId: string,
  variant: string,
  ext: string,
): string {
  return `events/${eventId}/${VARIANTS_SEGMENT}/${uploadId}/${variant}.${ext}`
}

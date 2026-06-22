import { cache } from 'react'
import { notFound } from 'next/navigation'
import {
  type CreateEventInput,
  createEvent,
  ensureEventQrCode,
  getEventByIdForPhotographer,
  getEventBySlug,
  getQrCodeByToken,
  listEventsByPhotographer,
} from '@/lib/db/queries/events'
import type { Event, EventQrCode } from '@/types'
import { generateEventSlug } from './slug'

const SLUG_RETRY_LIMIT = 5

function isSlugCollision(err: unknown): boolean {
  // Postgres unique_violation; events.slug is the only unique text column.
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}

export type CreateEventServiceInput = Omit<CreateEventInput, 'slug'>

// Creates an event, generating a unique slug from the title and retrying on the
// (rare) random-suffix collision so the caller never has to think about slugs.
export async function createEventForPhotographer(input: CreateEventServiceInput): Promise<Event> {
  for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt++) {
    try {
      return await createEvent({ ...input, slug: generateEventSlug(input.name) })
    } catch (err) {
      if (isSlugCollision(err) && attempt < SLUG_RETRY_LIMIT - 1) continue
      throw err
    }
  }
  // Unreachable: the loop either returns or throws above.
  throw new Error('Could not generate a unique event slug')
}

export const listEventsForPhotographer = listEventsByPhotographer

// Ownership-checked fetch for the detail shell; calls notFound() when the event
// is missing or owned by someone else. Cached so layout + page share one query.
export const getOwnedEventOrNotFound = cache(
  async (eventId: string, photographerId: string): Promise<Event> => {
    const event = await getEventByIdForPhotographer(eventId, photographerId)
    if (!event) notFound()
    return event
  },
)

// Lazily ensures (and returns) the event's QR metadata. Called from the owner's
// overview, so existing events get a QR row on first view — no backfill needed.
export function getOrCreateEventQrCode(event: Event): Promise<EventQrCode> {
  return ensureEventQrCode(event.id, event.slug)
}

export type PublicEventResolution =
  | { state: 'ok'; event: Event }
  | { state: 'not_found' }
  | { state: 'inactive'; event: Event; reason: 'not_published' | 'closed' | 'revoked' }

// Read-only resolution for the public /e/[slug] page. Uploads are accepted only
// when the event is active and its QR link hasn't been revoked. A missing QR row
// (owner never opened the overview) is treated as not-revoked.
export async function resolvePublicEvent(slug: string): Promise<PublicEventResolution> {
  const event = await getEventBySlug(slug)
  if (!event) return { state: 'not_found' }
  if (event.status === 'closed') return { state: 'inactive', event, reason: 'closed' }
  if (event.status !== 'active') return { state: 'inactive', event, reason: 'not_published' }

  const qr = await getQrCodeByToken(event.slug)
  if (qr && !qr.isActive) return { state: 'inactive', event, reason: 'revoked' }

  return { state: 'ok', event }
}

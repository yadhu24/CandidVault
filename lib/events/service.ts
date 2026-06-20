import { cache } from 'react'
import { notFound } from 'next/navigation'
import {
  type CreateEventInput,
  createEvent,
  getEventByIdForPhotographer,
  listEventsByPhotographer,
} from '@/lib/db/queries/events'
import type { Event } from '@/types'
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

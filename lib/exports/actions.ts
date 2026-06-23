'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import { track } from '@/lib/analytics/track'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import { createExport, getInFlightExport } from '@/lib/db/queries/exports'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'
import { rateLimit } from '@/lib/http/rate-limit'

export interface RequestExportResult {
  ok: boolean
  error?: string
}

// Exports are expensive (worker job + R2 multipart over every approved original).
// The per-event in-flight guard below stops concurrent builds; this per-user brake
// stops a photographer from queueing a flood across many events.
const EXPORT_REQUESTS_PER_MINUTE = 20

// Photographer requests a ZIP of the event's approved originals. Identity +
// ownership come from the session. The worker picks up the pending row.
export async function requestExportAction(eventId: string): Promise<RequestExportResult> {
  const { user } = await requirePhotographer()

  if (!rateLimit(`export:${user.id}`, EXPORT_REQUESTS_PER_MINUTE, 60_000)) {
    return { ok: false, error: 'Too many export requests. Please wait a moment and try again.' }
  }

  const event = await getEventByIdForPhotographer(eventId, user.id)
  if (!event) return { ok: false, error: 'Event not found.' }

  // Don't kick off a duplicate while one is already building.
  const inFlight = await getInFlightExport(eventId)
  if (inFlight) {
    revalidatePath(`/events/${eventId}/export`)
    return { ok: true }
  }

  const counts = await countUploadsByModeration(eventId)
  if (counts.approved === 0) {
    return { ok: false, error: 'There are no approved photos or videos to export yet.' }
  }

  await createExport({ eventId, requestedBy: user.id, scope: 'approved' })
  after(() =>
    track('export_requested', {
      eventId,
      actorId: user.id,
      actorType: 'photographer',
      properties: { approvedCount: counts.approved },
    }),
  )
  revalidatePath(`/events/${eventId}/export`)
  return { ok: true }
}

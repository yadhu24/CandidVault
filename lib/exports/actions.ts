'use server'

import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import { createExport, getInFlightExport } from '@/lib/db/queries/exports'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'

export interface RequestExportResult {
  ok: boolean
  error?: string
}

// Photographer requests a ZIP of the event's approved originals. Identity +
// ownership come from the session. The worker picks up the pending row.
export async function requestExportAction(eventId: string): Promise<RequestExportResult> {
  const { user } = await requirePhotographer()
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
  revalidatePath(`/events/${eventId}/export`)
  return { ok: true }
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import { track } from '@/lib/analytics/track'
import {
  deleteEventForPhotographer,
  updateEventForPhotographer,
} from '@/lib/db/queries/events'
import { CreateEventSchema, UpdateEventSchema } from '@/lib/validation/events'
import { createEventForPhotographer } from './service'
import type { CreateEventState, UpdateEventState } from './types'

const emptyToNull = (v: string | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

export async function createEventAction(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  // Owner comes from the session, never the form (CLAUDE.md §7).
  const { user } = await requirePhotographer()

  const parsed = CreateEventSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    eventType: String(formData.get('eventType') ?? ''),
    eventDate: String(formData.get('eventDate') ?? ''),
    venue: String(formData.get('venue') ?? ''),
    description: String(formData.get('description') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '')
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const event = await createEventForPhotographer({
    photographerId: user.id,
    name: parsed.data.name,
    eventType: parsed.data.eventType,
    eventDate: parsed.data.eventDate,
    venue: emptyToNull(parsed.data.venue),
    description: emptyToNull(parsed.data.description),
  })

  await track('event_created', {
    eventId: event.id,
    actorId: user.id,
    actorType: 'photographer',
    properties: { eventType: event.eventType },
  })

  // Refresh the dashboard list, then go straight to the new event's detail page.
  revalidatePath('/dashboard')
  redirect(`/events/${event.id}`)
}

export async function updateEventAction(
  _prev: UpdateEventState,
  formData: FormData,
): Promise<UpdateEventState> {
  // Identity from the session; ownership is enforced in the SQL predicate below.
  const { user } = await requirePhotographer()
  const eventId = String(formData.get('eventId') ?? '')
  if (!eventId) return { error: 'Missing event.' }

  const parsed = UpdateEventSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    eventType: String(formData.get('eventType') ?? ''),
    eventDate: String(formData.get('eventDate') ?? ''),
    venue: String(formData.get('venue') ?? ''),
    description: String(formData.get('description') ?? ''),
    status: String(formData.get('status') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '')
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors }
  }

  const updated = await updateEventForPhotographer(eventId, user.id, {
    name: parsed.data.name,
    eventType: parsed.data.eventType,
    eventDate: parsed.data.eventDate,
    venue: emptyToNull(parsed.data.venue),
    description: emptyToNull(parsed.data.description),
    status: parsed.data.status,
  })
  if (!updated) return { error: 'Event not found.' }

  revalidatePath(`/events/${eventId}/settings`)
  revalidatePath(`/events/${eventId}`)
  revalidatePath('/dashboard')
  return { ok: true }
}

// Destructive: removes the event and (via ON DELETE CASCADE) all of its uploads,
// variants, albums, QR codes, and exports. The underlying R2 objects are NOT
// deleted here — that needs a storage sweep (lifecycle rule or a cleanup job);
// tracked as future work in docs. Ownership is enforced in the SQL predicate.
export async function deleteEventAction(eventId: string): Promise<{ error?: string }> {
  const { user } = await requirePhotographer()
  if (!eventId) return { error: 'Missing event.' }

  const deleted = await deleteEventForPhotographer(eventId, user.id)
  if (!deleted) return { error: 'Event not found.' }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

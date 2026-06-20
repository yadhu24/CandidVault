'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import { CreateEventSchema } from '@/lib/validation/events'
import { createEventForPhotographer } from './service'
import type { CreateEventState } from './types'

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

  // Refresh the dashboard list, then go straight to the new event's detail page.
  revalidatePath('/dashboard')
  redirect(`/events/${event.id}`)
}

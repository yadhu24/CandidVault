'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requirePhotographer } from '@/lib/account/photographers'
import { track } from '@/lib/analytics/track'
import type { AnalyticsEventName } from '@/lib/analytics/events'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import {
  bulkModerate,
  moderateUpload,
  type ModerationDecision,
} from '@/lib/db/queries/moderation'

export interface ModerationActionResult {
  ok: boolean
  changed: number
  error?: string
}

const MAX_BULK = 200
const DECISIONS: ModerationDecision[] = ['approve', 'reject', 'restore']
const isDecision = (v: unknown): v is ModerationDecision =>
  typeof v === 'string' && (DECISIONS as string[]).includes(v)

// approve/reject map to analytics events; restore is internal and not tracked.
const DECISION_EVENT: Partial<Record<ModerationDecision, AnalyticsEventName>> = {
  approve: 'upload_approved',
  reject: 'upload_rejected',
}

// One analytics row per moderation action that changed something. properties.count
// carries how many uploads it affected (1 for single, N for bulk).
function trackModeration(
  decision: ModerationDecision,
  eventId: string,
  actorId: string,
  count: number,
) {
  const name = DECISION_EVENT[decision]
  if (!name || count <= 0) return
  after(() =>
    track(name, { eventId, actorId, actorType: 'photographer', properties: { count } }),
  )
}

// Identity + ownership come from the session, never the client (CLAUDE.md §7).
// Returns null when the photographer doesn't own the event, which every caller
// surfaces as a generic "not found" (no leak of whether the event exists).
async function authorizeEvent(eventId: string) {
  const { user } = await requirePhotographer()
  const event = await getEventByIdForPhotographer(eventId, user.id)
  return event ? { userId: user.id } : null
}

export async function moderateUploadAction(
  eventId: string,
  uploadId: string,
  decision: ModerationDecision,
): Promise<ModerationActionResult> {
  if (!isDecision(decision)) return { ok: false, changed: 0, error: 'Invalid action.' }

  const auth = await authorizeEvent(eventId)
  if (!auth) return { ok: false, changed: 0, error: 'Event not found.' }

  const { changed } = await moderateUpload(uploadId, eventId, auth.userId, decision)
  trackModeration(decision, eventId, auth.userId, changed ? 1 : 0)
  revalidatePath(`/events/${eventId}/uploads`)
  return { ok: true, changed: changed ? 1 : 0 }
}

export async function bulkModerateAction(
  eventId: string,
  uploadIds: string[],
  decision: ModerationDecision,
): Promise<ModerationActionResult> {
  if (!isDecision(decision)) return { ok: false, changed: 0, error: 'Invalid action.' }
  if (!Array.isArray(uploadIds) || uploadIds.length === 0) {
    return { ok: false, changed: 0, error: 'Nothing selected.' }
  }
  if (uploadIds.length > MAX_BULK) {
    return { ok: false, changed: 0, error: `Select at most ${MAX_BULK} at a time.` }
  }

  const auth = await authorizeEvent(eventId)
  if (!auth) return { ok: false, changed: 0, error: 'Event not found.' }

  const { changed } = await bulkModerate(uploadIds, eventId, auth.userId, decision)
  trackModeration(decision, eventId, auth.userId, changed)
  revalidatePath(`/events/${eventId}/uploads`)
  return { ok: true, changed }
}

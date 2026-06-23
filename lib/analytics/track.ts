import { insertAnalyticsEvent } from '@/lib/db/queries/analytics'
import type { AnalyticsActorType } from '@/lib/db/types'
import type { AnalyticsEventName } from './events'

export interface TrackInput {
  eventId?: string | null
  actorId?: string | null
  actorType?: AnalyticsActorType
  properties?: Record<string, unknown>
}

// Records a product event. Analytics must NEVER break a product flow, so this
// swallows its own failures (logged at warn) instead of throwing. Server-only:
// it imports the pg-backed query layer, so it can't be bundled into the client.
//
// Callers may `await track(...)` (e.g. inside next/after) or fire-and-forget with
// `void track(...)` — either way a failure won't surface to the user.
export async function track(name: AnalyticsEventName, input: TrackInput = {}): Promise<void> {
  try {
    await insertAnalyticsEvent({
      name,
      eventId: input.eventId ?? null,
      actorId: input.actorId ?? null,
      actorType: input.actorType ?? 'system',
      properties: input.properties ?? {},
    })
  } catch (err) {
    console.warn('[analytics] failed to record event', {
      name,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

import { query, withTransaction } from '../query'
import type { ModerationActionRecord, ModerationStatus } from '../types'

// Each decision maps to the moderation_status it sets; the same verb is written to
// the moderation_actions audit trail. `restore` returns an item to the queue.
const DECISION_TO_STATUS = {
  approve: 'approved',
  reject: 'rejected',
  restore: 'pending',
} as const
export type ModerationDecision = keyof typeof DECISION_TO_STATUS

export interface ModerationCounts {
  pending: number
  approved: number
  rejected: number
}

export async function countUploadsByModeration(eventId: string): Promise<ModerationCounts> {
  const rows = await query<{ moderationStatus: ModerationStatus; count: number }>(
    `SELECT moderation_status, COUNT(*)::int AS count
     FROM uploads
     WHERE event_id = $1
     GROUP BY moderation_status`,
    [eventId],
  )
  const counts: ModerationCounts = { pending: 0, approved: 0, rejected: 0 }
  for (const row of rows) counts[row.moderationStatus] = row.count
  return counts
}

// Single decision. Safe against double-clicks and concurrent moderators: the row
// only transitions when it is NOT already at the target status, and event_id is
// in the predicate so an upload from another event can never be touched even if a
// crafted id is supplied. The audit row is written in the same transaction, so
// status and history never drift. Returns whether it actually changed (false =
// idempotent no-op, e.g. already approved).
export async function moderateUpload(
  uploadId: string,
  eventId: string,
  actorId: string,
  decision: ModerationDecision,
): Promise<{ changed: boolean }> {
  const target = DECISION_TO_STATUS[decision]
  return withTransaction(async (client) => {
    const updated = await query<{ id: string }>(
      `UPDATE uploads SET moderation_status = $3
       WHERE id = $1 AND event_id = $2 AND moderation_status <> $3
       RETURNING id`,
      [uploadId, eventId, target],
      client,
    )
    if (updated.length === 0) return { changed: false }
    await client.query(
      `INSERT INTO moderation_actions (upload_id, actor_id, action) VALUES ($1, $2, $3)`,
      [uploadId, actorId, decision],
    )
    return { changed: true }
  })
}

// Bulk decision. One UPDATE transitions every selected, not-already-target,
// in-event upload; an audit row is written per actually-changed upload. Returns
// how many uploads changed.
export async function bulkModerate(
  uploadIds: string[],
  eventId: string,
  actorId: string,
  decision: ModerationDecision,
): Promise<{ changed: number }> {
  if (uploadIds.length === 0) return { changed: 0 }
  const target = DECISION_TO_STATUS[decision]
  return withTransaction(async (client) => {
    const changed = await query<{ id: string }>(
      `UPDATE uploads SET moderation_status = $3
       WHERE id = ANY($1::uuid[]) AND event_id = $2 AND moderation_status <> $3
       RETURNING id`,
      [uploadIds, eventId, target],
      client,
    )
    for (const row of changed) {
      await client.query(
        `INSERT INTO moderation_actions (upload_id, actor_id, action) VALUES ($1, $2, $3)`,
        [row.id, actorId, decision],
      )
    }
    return { changed: changed.length }
  })
}

export function listModerationActions(uploadId: string): Promise<ModerationActionRecord[]> {
  return query<ModerationActionRecord>(
    `SELECT * FROM moderation_actions WHERE upload_id = $1 ORDER BY created_at DESC`,
    [uploadId],
  )
}

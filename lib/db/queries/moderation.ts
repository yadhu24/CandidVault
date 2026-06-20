import { query, queryOne, withTransaction } from '../query'
import type { ModerationAction, ModerationActionRecord, ModerationStatus, Upload } from '../types'

// How each action moves the upload's denormalized moderation_status. `delete`
// is a soft decision here (hides from galleries/exports); actual row/object
// removal is a separate, deliberate operation.
const ACTION_TO_STATUS: Record<ModerationAction, ModerationStatus> = {
  approve: 'approved',
  reject: 'rejected',
  restore: 'pending',
  delete: 'rejected',
}

export interface ModerateInput {
  uploadId: string
  action: ModerationAction
  actorId?: string | null
  reason?: string | null
}

// Records the action and updates the upload's current status atomically, so the
// audit trail and the denormalized state can never drift apart.
export async function moderateUpload(
  input: ModerateInput,
): Promise<{ upload: Upload; action: ModerationActionRecord }> {
  return withTransaction(async (client) => {
    const [action] = await query<ModerationActionRecord>(
      `INSERT INTO moderation_actions (upload_id, actor_id, action, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.uploadId, input.actorId ?? null, input.action, input.reason ?? null],
      client,
    )
    const upload = await queryOne<Upload>(
      `UPDATE uploads SET moderation_status = $2 WHERE id = $1 RETURNING *`,
      [input.uploadId, ACTION_TO_STATUS[input.action]],
      client,
    )
    if (!upload) throw new Error(`upload not found: ${input.uploadId}`)
    return { upload, action }
  })
}

export function listModerationActions(uploadId: string): Promise<ModerationActionRecord[]> {
  return query<ModerationActionRecord>(
    `SELECT * FROM moderation_actions WHERE upload_id = $1 ORDER BY created_at DESC`,
    [uploadId],
  )
}

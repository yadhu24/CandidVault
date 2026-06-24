import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasTestDb,
  resetTables,
  seedEvent,
  seedPhotographer,
  seedUpload,
  setupTestDatabase,
} from '../helpers/db'

const auth = vi.hoisted(() => ({ userId: '' }))
const hoisted = vi.hoisted(() => ({ after: [] as Promise<unknown>[] }))

vi.mock('@/lib/account/photographers', () => ({
  requirePhotographer: async () => ({
    user: { id: auth.userId, email: 'p@example.com', role: 'photographer' },
    profile: { id: 'profile', userId: auth.userId },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    hoisted.after.push(Promise.resolve().then(fn))
  },
}))

import { bulkModerateAction, moderateUploadAction } from '@/lib/moderation/actions'
import { query } from '@/lib/db/query'

const flushAfter = async () => {
  await Promise.all(hoisted.after)
  hoisted.after.length = 0
}

async function moderationStatus(id: string): Promise<string> {
  const rows = await query<{ moderation_status: string }>(
    `SELECT moderation_status FROM uploads WHERE id = $1`,
    [id],
  )
  return rows[0]?.moderation_status
}

describe.skipIf(!hasTestDb)('moderation actions (integration)', () => {
  beforeAll(setupTestDatabase)
  beforeEach(async () => {
    await resetTables()
    hoisted.after.length = 0
  })

  it('approves a pending upload, writes an audit row, and is idempotent', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    const upload = await seedUpload({ eventId: event.id, moderationStatus: 'pending' })

    const first = await moderateUploadAction(event.id, upload.id, 'approve')
    await flushAfter()
    expect(first).toEqual({ ok: true, changed: 1 })
    expect(await moderationStatus(upload.id)).toBe('approved')

    const audit = await query<{ action: string }>(
      `SELECT action FROM moderation_actions WHERE upload_id = $1`,
      [upload.id],
    )
    expect(audit).toEqual([{ action: 'approve' }])

    // Re-approving is a no-op.
    const second = await moderateUploadAction(event.id, upload.id, 'approve')
    await flushAfter()
    expect(second.changed).toBe(0)
  })

  it('cannot moderate an upload belonging to another event', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const eventA = await seedEvent({ photographerId: photographer.id })
    const eventB = await seedEvent({ photographerId: photographer.id })
    const uploadB = await seedUpload({ eventId: eventB.id, moderationStatus: 'pending' })

    const result = await moderateUploadAction(eventA.id, uploadB.id, 'approve')
    await flushAfter()
    expect(result.changed).toBe(0)
    expect(await moderationStatus(uploadB.id)).toBe('pending')
  })

  it('refuses when the photographer does not own the event', async () => {
    const owner = await seedPhotographer()
    const stranger = await seedPhotographer()
    auth.userId = stranger.id
    const event = await seedEvent({ photographerId: owner.id })
    const upload = await seedUpload({ eventId: event.id, moderationStatus: 'pending' })

    const result = await moderateUploadAction(event.id, upload.id, 'approve')
    expect(result).toEqual({ ok: false, changed: 0, error: 'Event not found.' })
    expect(await moderationStatus(upload.id)).toBe('pending')
  })

  it('bulk-rejects multiple uploads and reports the count', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    const u1 = await seedUpload({ eventId: event.id, moderationStatus: 'pending' })
    const u2 = await seedUpload({ eventId: event.id, moderationStatus: 'pending' })

    const result = await bulkModerateAction(event.id, [u1.id, u2.id], 'reject')
    await flushAfter()
    expect(result).toEqual({ ok: true, changed: 2 })
    expect(await moderationStatus(u1.id)).toBe('rejected')
    expect(await moderationStatus(u2.id)).toBe('rejected')
  })

  it('rejects an invalid decision', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    const upload = await seedUpload({ eventId: event.id })
    // @ts-expect-error — exercising the runtime guard with a bad decision
    const result = await moderateUploadAction(event.id, upload.id, 'banish')
    expect(result.ok).toBe(false)
  })
})

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

import { requestExportAction } from '@/lib/exports/actions'
import {
  claimNextExport,
  getExportForEvent,
  listExportsByEvent,
  markExportReady,
} from '@/lib/db/queries/exports'

const flushAfter = async () => {
  await Promise.all(hoisted.after)
  hoisted.after.length = 0
}

describe.skipIf(!hasTestDb)('export request flow (integration)', () => {
  beforeAll(setupTestDatabase)
  beforeEach(async () => {
    await resetTables()
    hoisted.after.length = 0
  })

  it('creates a pending export when there is approved media', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    await seedUpload({ eventId: event.id, moderationStatus: 'approved' })

    const result = await requestExportAction(event.id)
    await flushAfter()
    expect(result.ok).toBe(true)

    const exports = await listExportsByEvent(event.id)
    expect(exports).toHaveLength(1)
    expect(exports[0].status).toBe('pending')
    expect(exports[0].scope).toBe('approved')
  })

  it('does not queue a duplicate while one is in flight', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    await seedUpload({ eventId: event.id, moderationStatus: 'approved' })

    await requestExportAction(event.id)
    await requestExportAction(event.id)
    await flushAfter()

    expect(await listExportsByEvent(event.id)).toHaveLength(1)
  })

  it('refuses when there is no approved media', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    await seedUpload({ eventId: event.id, moderationStatus: 'pending' })

    const result = await requestExportAction(event.id)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/no approved/i)
    expect(await listExportsByEvent(event.id)).toHaveLength(0)
  })

  it('refuses when the photographer does not own the event', async () => {
    const owner = await seedPhotographer()
    const stranger = await seedPhotographer()
    auth.userId = stranger.id
    const event = await seedEvent({ photographerId: owner.id })
    await seedUpload({ eventId: event.id, moderationStatus: 'approved' })

    const result = await requestExportAction(event.id)
    expect(result).toEqual({ ok: false, error: 'Event not found.' })
    expect(await listExportsByEvent(event.id)).toHaveLength(0)
  })

  it('worker lifecycle: claim → ready, scoped reads', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id
    const event = await seedEvent({ photographerId: photographer.id })
    await seedUpload({ eventId: event.id, moderationStatus: 'approved' })
    await requestExportAction(event.id)
    await flushAfter()

    const claimed = await claimNextExport()
    expect(claimed?.status).toBe('processing')

    const ready = await markExportReady(claimed!.id, {
      storageKey: `events/${event.id}/exports/${claimed!.id}.zip`,
      fileSizeBytes: 4242,
      itemCount: 1,
      expiresAt: new Date('2099-01-01').toISOString(),
    })
    expect(ready?.status).toBe('ready')

    // Ownership-scoped read.
    expect(await getExportForEvent(claimed!.id, event.id)).not.toBeNull()
    const otherEvent = await seedEvent({ photographerId: photographer.id })
    expect(await getExportForEvent(claimed!.id, otherEvent.id)).toBeNull()
  })
})

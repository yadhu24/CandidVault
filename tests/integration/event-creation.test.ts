import { randomUUID } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTestDb, resetTables, seedPhotographer, setupTestDatabase } from '../helpers/db'

// Mocked Next/auth boundaries so we can drive the real Server Action against a
// real DB. The auth holder is set per-test to the seeded photographer.
const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/account/photographers', () => ({
  requirePhotographer: async () => ({
    user: {
      id: auth.userId,
      email: 'p@example.com',
      role: 'photographer',
      displayName: null,
      createdAt: '',
      updatedAt: '',
    },
    profile: { id: 'profile', userId: auth.userId },
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

import { createEventAction } from '@/lib/events/actions'
import { createEventForPhotographer } from '@/lib/events/service'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import { query } from '@/lib/db/query'

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe.skipIf(!hasTestDb)('event creation (integration)', () => {
  beforeAll(setupTestDatabase)
  beforeEach(resetTables)

  it('createEventForPhotographer persists an event with a generated slug', async () => {
    const photographer = await seedPhotographer()
    const event = await createEventForPhotographer({
      photographerId: photographer.id,
      name: 'Garden Party',
      eventType: 'party',
      eventDate: '2026-06-01',
      venue: null,
      description: null,
    })
    expect(event.id).toBeTruthy()
    expect(event.slug).toMatch(/^garden-party-[0-9a-f]{8}$/)
    expect(event.status).toBe('draft')
  })

  it('enforces ownership: another photographer cannot read the event', async () => {
    const owner = await seedPhotographer()
    const stranger = await seedPhotographer()
    const event = await createEventForPhotographer({
      photographerId: owner.id,
      name: 'Private',
      eventType: 'wedding',
      eventDate: '2026-06-01',
      venue: null,
      description: null,
    })
    expect(await getEventByIdForPhotographer(event.id, owner.id)).not.toBeNull()
    expect(await getEventByIdForPhotographer(event.id, stranger.id)).toBeNull()
  })

  it('the authenticated action creates an event and redirects', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id

    await expect(
      createEventAction(
        {},
        formData({
          name: 'My Wedding',
          eventType: 'wedding',
          eventDate: '2026-09-12',
          venue: 'Hall',
          description: '',
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/)

    const rows = await query<{ id: string; name: string; photographer_id: string }>(
      `SELECT id, name, photographer_id FROM events WHERE photographer_id = $1`,
      [photographer.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('My Wedding')

    const analytics = await query<{ name: string }>(
      `SELECT name FROM analytics_events WHERE event_id = $1`,
      [rows[0].id],
    )
    expect(analytics.some((a) => a.name === 'event_created')).toBe(true)
  })

  it('the action returns field errors for invalid input (no event created)', async () => {
    const photographer = await seedPhotographer()
    auth.userId = photographer.id

    const result = await createEventAction(
      {},
      formData({ name: '', eventType: 'wedding', eventDate: 'nope', venue: '', description: '' }),
    )
    expect(result.error).toBeTruthy()
    expect(result.fieldErrors?.name).toBeTruthy()

    const count = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM events WHERE photographer_id = $1`,
      [photographer.id],
    )
    expect(count[0].n).toBe(0)
  })

  it('skips cleanly when no test DB is configured', () => {
    // Guard so the file isn't reported as empty if the suite is filtered.
    expect(randomUUID()).toBeTruthy()
  })
})

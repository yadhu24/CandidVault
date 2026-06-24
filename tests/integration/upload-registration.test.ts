import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDb, resetTables, seedEvent, seedPhotographer, setupTestDatabase } from '../helpers/db'
import {
  getEventUploadUsage,
  getUploadByStorageKey,
  registerUpload,
} from '@/lib/db/queries/uploads'

describe.skipIf(!hasTestDb)('upload completion registration (integration)', () => {
  beforeAll(setupTestDatabase)
  beforeEach(resetTables)

  async function setup() {
    const photographer = await seedPhotographer()
    const event = await seedEvent({ photographerId: photographer.id })
    return event
  }

  it('registers a completed upload in pending state', async () => {
    const event = await setup()
    const key = `events/${event.id}/originals/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`
    const upload = await registerUpload({
      eventId: event.id,
      storageKey: key,
      mediaType: 'photo',
      mimeType: 'image/jpeg',
      fileSizeBytes: 2_000_000,
      guestSessionId: null,
      uploaderName: 'Sam',
      originalFilename: 'sam.jpg',
    })
    expect(upload.status).toBe('pending')
    expect(upload.moderationStatus).toBe('pending')
    expect(await getUploadByStorageKey(key)).not.toBeNull()
  })

  it('is idempotent on storage_key (retried confirm returns the same row)', async () => {
    const event = await setup()
    const key = `events/${event.id}/originals/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg`
    const input = {
      eventId: event.id,
      storageKey: key,
      mediaType: 'photo' as const,
      mimeType: 'image/jpeg',
      fileSizeBytes: 1_500_000,
      guestSessionId: null,
      uploaderName: null,
      originalFilename: null,
    }
    const first = await registerUpload(input)
    const second = await registerUpload(input)
    expect(second.id).toBe(first.id)

    const usage = await getEventUploadUsage(event.id)
    expect(usage.count).toBe(1)
    expect(usage.totalBytes).toBe(1_500_000)
  })

  it('aggregates usage across multiple uploads', async () => {
    const event = await setup()
    for (let i = 0; i < 3; i++) {
      await registerUpload({
        eventId: event.id,
        storageKey: `events/${event.id}/originals/c${i}.jpg`,
        mediaType: 'photo',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1_000_000,
        guestSessionId: null,
        uploaderName: null,
        originalFilename: null,
      })
    }
    const usage = await getEventUploadUsage(event.id)
    expect(usage.count).toBe(3)
    expect(usage.totalBytes).toBe(3_000_000)
  })
})

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  hasTestDb,
  resetTables,
  seedEvent,
  seedPhotographer,
  seedUpload,
  setupTestDatabase,
} from '../helpers/db'
import {
  addAlbumItem,
  createAlbum,
  getAlbumForEvent,
  listAlbumItems,
  listAlbumUploads,
  removeAlbumItem,
} from '@/lib/db/queries/albums'

describe.skipIf(!hasTestDb)('album operations (integration)', () => {
  beforeAll(setupTestDatabase)
  beforeEach(resetTables)

  async function setup() {
    const photographer = await seedPhotographer()
    const event = await seedEvent({ photographerId: photographer.id })
    const upload = await seedUpload({ eventId: event.id, moderationStatus: 'approved' })
    return { photographer, event, upload }
  }

  it('creates an album scoped to its event', async () => {
    const { event } = await setup()
    const album = await createAlbum({ eventId: event.id, name: 'Ceremony' })
    expect(album.name).toBe('Ceremony')

    expect(await getAlbumForEvent(album.id, event.id)).not.toBeNull()
    // Not reachable from a different event.
    const other = await seedEvent({ photographerId: (await seedPhotographer()).id })
    expect(await getAlbumForEvent(album.id, other.id)).toBeNull()
  })

  it('adds an upload to an album idempotently', async () => {
    const { event, upload } = await setup()
    const album = await createAlbum({ eventId: event.id, name: 'Highlights' })

    await addAlbumItem(album.id, upload.id, 0)
    await addAlbumItem(album.id, upload.id, 5) // same pair → updates position, no dup
    const items = await listAlbumItems(album.id)
    expect(items).toHaveLength(1)
    expect(items[0].position).toBe(5)
  })

  it('lists album uploads and supports removal', async () => {
    const { event, upload } = await setup()
    const album = await createAlbum({ eventId: event.id, name: 'Reception' })
    await addAlbumItem(album.id, upload.id)

    const uploads = await listAlbumUploads(album.id)
    expect(uploads.map((u) => u.id)).toContain(upload.id)

    await removeAlbumItem(album.id, upload.id)
    expect(await listAlbumItems(album.id)).toHaveLength(0)
  })
})

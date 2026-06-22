import { requirePhotographer } from '@/lib/account/photographers'
import { listAlbumsByEvent } from '@/lib/db/queries/albums'
import type { MediaType } from '@/lib/db/types'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { loadGalleryPage } from '@/lib/gallery/serialize'
import type { GallerySort, GalleryTypeFilter } from '@/lib/gallery/types'
import { Gallery } from './Gallery'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string; sort?: string; fav?: string }>
}

export default async function EventGalleryPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const sort: GallerySort = sp.sort === 'oldest' ? 'oldest' : 'newest'
  const type: GalleryTypeFilter = sp.type === 'photo' || sp.type === 'video' ? sp.type : 'all'
  const favorites = sp.fav === '1'
  const mediaType: MediaType | undefined = type === 'all' ? undefined : type

  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id) // ownership; notFound otherwise

  const [initial, albums] = await Promise.all([
    loadGalleryPage(event.id, { mediaType, sort, offset: 0, favoritesOnly: favorites }),
    listAlbumsByEvent(event.id),
  ])

  return (
    <Gallery
      // Remount on filter/sort/favorites change so the loaded list resets cleanly.
      key={`${type}-${sort}-${favorites}`}
      eventId={event.id}
      type={type}
      sort={sort}
      favorites={favorites}
      albums={albums.map((a) => ({ id: a.id, name: a.name }))}
      initial={initial}
    />
  )
}

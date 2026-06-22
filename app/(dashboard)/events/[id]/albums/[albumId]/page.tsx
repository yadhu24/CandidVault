import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePhotographer } from '@/lib/account/photographers'
import { getAlbumForEvent, listAlbumUploads } from '@/lib/db/queries/albums'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { toGalleryItem } from '@/lib/gallery/serialize'
import { AlbumDetail } from './AlbumDetail'

interface Props {
  params: Promise<{ id: string; albumId: string }>
}

export default async function AlbumDetailPage({ params }: Props) {
  const { id, albumId } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id)

  const album = await getAlbumForEvent(albumId, event.id) // event-scoped ownership
  if (!album) notFound()

  const rows = await listAlbumUploads(albumId)
  const items = await Promise.all(rows.map(toGalleryItem))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/events/${event.id}/albums`}
          className="inline-flex items-center gap-1 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← All albums
        </Link>
        <h2 className="font-display text-h1 text-foreground">{album.name}</h2>
        {album.description && (
          <p className="text-body-sm text-muted-foreground">{album.description}</p>
        )}
      </div>

      <AlbumDetail eventId={event.id} albumId={album.id} initialItems={items} />
    </div>
  )
}

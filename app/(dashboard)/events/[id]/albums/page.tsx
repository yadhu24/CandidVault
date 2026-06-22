import Link from 'next/link'
import { Card, CardContent, EmptyState } from '@/components/ui'
import { FolderIcon } from '@/components/ui/icons'
import { requirePhotographer } from '@/lib/account/photographers'
import { listAlbumsWithMeta } from '@/lib/db/queries/albums'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { createDownloadPresignedUrl } from '@/lib/storage'
import { CreateAlbumForm } from './CreateAlbumForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventAlbumsPage({ params }: Props) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id)

  const albums = await listAlbumsWithMeta(event.id)
  const cards = await Promise.all(
    albums.map(async (a) => ({
      id: a.id,
      name: a.name,
      itemCount: a.itemCount,
      coverUrl: a.coverThumbnailKey ? await createDownloadPresignedUrl(a.coverThumbnailKey) : null,
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-h2 text-foreground">Albums</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Group approved photos and videos into collections.
          </p>
        </div>
        <CreateAlbumForm eventId={event.id} />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="size-6" />}
          title="No albums yet"
          description="Create an album, then add approved photos to it from the Gallery."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((album) => (
            <Link
              key={album.id}
              href={`/events/${event.id}/albums/${album.id}`}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                  {album.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={album.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <FolderIcon className="size-8 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="py-3">
                  <p className="truncate font-medium text-foreground">{album.name}</p>
                  <p className="text-caption text-muted-foreground">
                    {album.itemCount} {album.itemCount === 1 ? 'item' : 'items'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

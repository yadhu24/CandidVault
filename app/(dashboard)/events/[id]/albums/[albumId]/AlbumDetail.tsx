'use client'

import { useState, useTransition } from 'react'
import { Button, EmptyState, MediaGrid, MediaTile, Modal } from '@/components/ui'
import { ImageIcon, TrashIcon } from '@/components/ui/icons'
import { removeFromAlbumAction } from '@/lib/albums/actions'
import type { GalleryItem } from '@/lib/gallery/types'

interface Props {
  eventId: string
  albumId: string
  initialItems: GalleryItem[]
}

export function AlbumDetail({ eventId, albumId, initialItems }: Props) {
  const [items, setItems] = useState<GalleryItem[]>(initialItems)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const preview = previewId ? (items.find((i) => i.id === previewId) ?? null) : null

  function remove(uploadId: string) {
    setItems((prev) => prev.filter((i) => i.id !== uploadId))
    setPreviewId(null)
    start(async () => {
      await removeFromAlbumAction(eventId, albumId, uploadId)
    })
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="size-6" />}
        title="No photos in this album yet"
        description="Open the Gallery, tap a photo, and add it to this album."
      />
    )
  }

  return (
    <>
      <MediaGrid>
        {items.map((item) => (
          <MediaTile
            key={item.id}
            src={item.thumbUrl ?? undefined}
            alt={`Media from ${item.uploaderName ?? 'a guest'}`}
            type={item.mediaType}
            durationLabel={item.durationLabel}
            onClick={() => setPreviewId(item.id)}
          />
        ))}
      </MediaGrid>

      <Modal open={preview !== null} onClose={() => setPreviewId(null)} className="max-w-2xl">
        {preview && (
          <div>
            <div className="overflow-hidden rounded-xl bg-muted">
              {preview.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.previewUrl}
                  alt={`Media from ${preview.uploaderName ?? 'a guest'}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="size-8" />
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {preview.uploaderName ?? 'Guest'}
                </p>
                <p className="text-caption text-muted-foreground">
                  {preview.mediaType === 'video' ? 'Video' : 'Photo'} · {preview.sizeLabel} ·{' '}
                  {preview.timeLabel}
                </p>
              </div>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => remove(preview.id)}>
                <TrashIcon className="size-4" /> Remove
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

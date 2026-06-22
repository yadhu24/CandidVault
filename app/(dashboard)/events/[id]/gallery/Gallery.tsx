'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge, Button, EmptyState, MediaGrid, MediaTile, Modal, Spinner, StatusPill } from '@/components/ui'
import { ImageIcon, StarIcon } from '@/components/ui/icons'
import { addToAlbumAction, toggleFavoriteAction } from '@/lib/albums/actions'
import { cn } from '@/lib/utils'
import type { GalleryItem, GalleryPage, GallerySort, GalleryTypeFilter } from '@/lib/gallery/types'

interface AlbumOption {
  id: string
  name: string
}

interface Props {
  eventId: string
  type: GalleryTypeFilter
  sort: GallerySort
  favorites: boolean
  albums: AlbumOption[]
  initial: GalleryPage
}

export function Gallery({ eventId, type, sort, favorites, albums, initial }: Props) {
  const [items, setItems] = useState<GalleryItem[]>(initial.items)
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset)
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [, startFav] = useTransition()
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const favSuffix = favorites ? '&fav=1' : ''

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextOffset == null) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(
        `/api/events/${eventId}/gallery?type=${type}&sort=${sort}&offset=${nextOffset}${favSuffix}`,
      )
      if (res.ok) {
        const page = (await res.json()) as GalleryPage
        setItems((prev) => [...prev, ...page.items])
        setNextOffset(page.nextOffset)
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [eventId, type, sort, favSuffix, nextOffset])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '600px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  function toggleFavorite(item: GalleryItem) {
    const next = !item.isFavorite
    setItems((prev) =>
      prev.flatMap((it) => {
        if (it.id !== item.id) return [it]
        // Dropping a favorite while viewing the favorites filter removes it.
        if (!next && favorites) return []
        return [{ ...it, isFavorite: next }]
      }),
    )
    startFav(async () => {
      await toggleFavoriteAction(eventId, item.id, next)
    })
  }

  const base = `/events/${eventId}/gallery`
  const preview = previewId ? (items.find((i) => i.id === previewId) ?? null) : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h2 text-foreground">Gallery</h2>
        <div className="flex flex-wrap gap-2">
          <Seg>
            <SegLink href={`${base}?type=all&sort=${sort}${favSuffix}`} active={type === 'all'}>
              All
            </SegLink>
            <SegLink href={`${base}?type=photo&sort=${sort}${favSuffix}`} active={type === 'photo'}>
              Photos
            </SegLink>
            <SegLink href={`${base}?type=video&sort=${sort}${favSuffix}`} active={type === 'video'}>
              Videos
            </SegLink>
          </Seg>
          <Seg>
            <SegLink href={`${base}?type=${type}&sort=newest${favSuffix}`} active={sort === 'newest'}>
              Newest
            </SegLink>
            <SegLink href={`${base}?type=${type}&sort=oldest${favSuffix}`} active={sort === 'oldest'}>
              Oldest
            </SegLink>
          </Seg>
          <Seg>
            <SegLink
              href={favorites ? `${base}?type=${type}&sort=${sort}` : `${base}?type=${type}&sort=${sort}&fav=1`}
              active={favorites}
            >
              ★ Favorites
            </SegLink>
          </Seg>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={favorites ? <StarIcon className="size-6" /> : <ImageIcon className="size-6" />}
          title={favorites ? 'No favorites yet' : 'No approved media yet'}
          description={
            favorites
              ? 'Tap the star on any photo to keep your picks here.'
              : 'Approved photos and videos appear here. Review pending uploads in the Uploads tab.'
          }
        />
      ) : (
        <>
          <MediaGrid>
            {items.map((item) => (
              <MediaTile
                key={item.id}
                src={item.thumbUrl ?? undefined}
                alt={`Media from ${item.uploaderName ?? 'a guest'}`}
                type={item.mediaType}
                durationLabel={item.durationLabel}
                favorite={item.isFavorite}
                onToggleFavorite={() => toggleFavorite(item)}
                onClick={() => setPreviewId(item.id)}
              />
            ))}
          </MediaGrid>

          {nextOffset != null && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {loading && <Spinner className="size-5 text-muted-foreground" label="Loading more" />}
            </div>
          )}
        </>
      )}

      <Modal open={preview !== null} onClose={() => setPreviewId(null)} className="max-w-2xl">
        {preview && (
          <PreviewBody
            item={preview}
            eventId={eventId}
            albums={albums}
            onToggleFavorite={() => toggleFavorite(preview)}
          />
        )}
      </Modal>
    </div>
  )
}

function PreviewBody({
  item,
  eventId,
  albums,
  onToggleFavorite,
}: {
  item: GalleryItem
  eventId: string
  albums: AlbumOption[]
  onToggleFavorite: () => void
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-muted">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl}
            alt={`Media from ${item.uploaderName ?? 'a guest'}`}
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="size-8" />
            <p className="text-caption">
              {item.mediaType === 'video' ? 'Video preview not ready yet' : 'Preview not ready yet'}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{item.uploaderName ?? 'Guest'}</p>
          <p className="text-caption text-muted-foreground">
            {item.mediaType === 'video' ? 'Video' : 'Photo'} · {item.sizeLabel} · {item.timeLabel}
            {item.durationLabel ? ` · ${item.durationLabel}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.mediaType === 'video' && <Badge variant="info">Video</Badge>}
          <StatusPill status="approved" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button variant={item.isFavorite ? 'secondary' : 'outline'} size="sm" onClick={onToggleFavorite}>
          <StarIcon className={cn('size-4', item.isFavorite && 'fill-current text-gold-500')} />
          {item.isFavorite ? 'Favorited' : 'Favorite'}
        </Button>
        <AddToAlbum eventId={eventId} albums={albums} uploadId={item.id} />
      </div>
    </div>
  )
}

function AddToAlbum({
  eventId,
  albums,
  uploadId,
}: {
  eventId: string
  albums: AlbumOption[]
  uploadId: string
}) {
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? '')
  const [added, setAdded] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (albums.length === 0) {
    return (
      <p className="text-caption text-muted-foreground">
        Create an album in the Albums tab to organize photos.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={albumId}
        onChange={(e) => {
          setAlbumId(e.target.value)
          setAdded(null)
        }}
        aria-label="Choose album"
        className="h-9 rounded-md border border-input bg-card px-2 text-body-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {albums.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !albumId}
        onClick={() =>
          start(async () => {
            const res = await addToAlbumAction(eventId, albumId, uploadId)
            if (res.ok) setAdded(albums.find((a) => a.id === albumId)?.name ?? 'album')
          })
        }
      >
        Add
      </Button>
      {added && <span className="text-caption text-success">Added to {added}</span>}
    </div>
  )
}

function Seg({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex rounded-lg border border-border bg-card p-1">{children}</div>
}

function SegLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        'rounded-md px-3 py-1.5 text-caption font-medium transition-colors ' +
        (active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </Link>
  )
}

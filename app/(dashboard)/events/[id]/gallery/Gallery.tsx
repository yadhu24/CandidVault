'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge, EmptyState, MediaGrid, MediaTile, Modal, Spinner, StatusPill } from '@/components/ui'
import { ImageIcon } from '@/components/ui/icons'
import type { GalleryItem, GalleryPage, GallerySort, GalleryTypeFilter } from '@/lib/gallery/types'

interface Props {
  eventId: string
  type: GalleryTypeFilter
  sort: GallerySort
  initial: GalleryPage
}

export function Gallery({ eventId, type, sort, initial }: Props) {
  const [items, setItems] = useState<GalleryItem[]>(initial.items)
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<GalleryItem | null>(null)
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextOffset == null) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(
        `/api/events/${eventId}/gallery?type=${type}&sort=${sort}&offset=${nextOffset}`,
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
  }, [eventId, type, sort, nextOffset])

  // Auto-load the next page when the sentinel approaches the viewport.
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

  const base = `/events/${eventId}/gallery`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h2 text-foreground">Gallery</h2>
        <div className="flex flex-wrap gap-2">
          <Seg>
            <SegLink href={`${base}?type=all&sort=${sort}`} active={type === 'all'}>
              All
            </SegLink>
            <SegLink href={`${base}?type=photo&sort=${sort}`} active={type === 'photo'}>
              Photos
            </SegLink>
            <SegLink href={`${base}?type=video&sort=${sort}`} active={type === 'video'}>
              Videos
            </SegLink>
          </Seg>
          <Seg>
            <SegLink href={`${base}?type=${type}&sort=newest`} active={sort === 'newest'}>
              Newest
            </SegLink>
            <SegLink href={`${base}?type=${type}&sort=oldest`} active={sort === 'oldest'}>
              Oldest
            </SegLink>
          </Seg>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-6" />}
          title="No approved media yet"
          description="Approved photos and videos appear here. Review pending uploads in the Uploads tab."
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
                onClick={() => setPreview(item)}
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

      <Modal open={preview !== null} onClose={() => setPreview(null)} className="max-w-2xl">
        {preview && <PreviewBody item={preview} />}
      </Modal>
    </div>
  )
}

function PreviewBody({ item }: { item: GalleryItem }) {
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

'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, EmptyState, Spinner, StatusPill } from '@/components/ui'
import { CheckIcon, CloseIcon, ImageIcon, InboxIcon, PlayIcon, RetryIcon } from '@/components/ui/icons'
import { bulkModerateAction, moderateUploadAction } from '@/lib/moderation/actions'
import type { ModerationCounts, ModerationDecision } from '@/lib/db/queries/moderation'
import type { ModerationStatus } from '@/lib/db/types'
import type { ModerationPage, ModerationTypeFilter, QueueItem } from '@/lib/moderation/types'

interface Props {
  eventId: string
  status: ModerationStatus
  mediaType: ModerationTypeFilter
  counts: ModerationCounts
  initial: ModerationPage
}

export function ModerationQueue({ eventId, status, mediaType, counts, initial }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<QueueItem[]>(initial.items)
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const loadingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || nextOffset == null) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(
        `/api/events/${eventId}/uploads?status=${status}&type=${mediaType}&offset=${nextOffset}`,
      )
      if (res.ok) {
        const page = (await res.json()) as ModerationPage
        setItems((prev) => [...prev, ...page.items])
        setNextOffset(page.nextOffset)
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [eventId, status, mediaType, nextOffset])

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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Every available decision moves an item out of the current status filter, so we
  // optimistically remove it, then refresh to resync the header counts. On failure
  // we put it back.
  function decide(item: QueueItem, decision: ModerationDecision) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setSelected((prev) => {
      if (!prev.has(item.id)) return prev
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })
    startTransition(async () => {
      const res = await moderateUploadAction(eventId, item.id, decision)
      if (!res.ok) setItems((prev) => [item, ...prev])
      router.refresh()
    })
  }

  function bulkDecide(decision: ModerationDecision) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const removed = items.filter((i) => selected.has(i.id))
    setItems((prev) => prev.filter((i) => !selected.has(i.id)))
    setSelected(new Set())
    startTransition(async () => {
      const res = await bulkModerateAction(eventId, ids, decision)
      if (!res.ok) setItems((prev) => [...removed, ...prev])
      router.refresh()
    })
  }

  return (
    <div className="space-y-6 pb-24">
      <Filters eventId={eventId} status={status} mediaType={mediaType} counts={counts} />

      {items.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="size-6" />}
          title={status === 'pending' ? 'All caught up' : `No ${status} uploads`}
          description={
            status === 'pending'
              ? 'Every upload has been reviewed. New guest uploads will appear here.'
              : 'Try a different filter to see more.'
          }
        />
      ) : (
        <div
          className={isPending ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'}
          aria-busy={isPending}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ModerationCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onApprove={() => decide(item, 'approve')}
                onReject={() => decide(item, 'reject')}
                onRestore={() => decide(item, 'restore')}
              />
            ))}
          </div>
        </div>
      )}

      {nextOffset != null && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Spinner className="size-5 text-muted-foreground" label="Loading more" />}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
            <span className="text-body-sm font-medium text-foreground">
              {selected.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={isPending}>
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulkDecide('reject')} disabled={isPending}>
                <CloseIcon className="size-4" /> Reject all
              </Button>
              <Button size="sm" onClick={() => bulkDecide('approve')} disabled={isPending}>
                <CheckIcon className="size-4" /> Approve all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Filters({
  eventId,
  status,
  mediaType,
  counts,
}: {
  eventId: string
  status: ModerationStatus
  mediaType: ModerationTypeFilter
  counts: ModerationCounts
}) {
  const base = `/events/${eventId}/uploads`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegGroup>
        <SegLink href={`${base}?status=pending&type=${mediaType}`} active={status === 'pending'}>
          Pending {counts.pending}
        </SegLink>
        <SegLink href={`${base}?status=approved&type=${mediaType}`} active={status === 'approved'}>
          Approved {counts.approved}
        </SegLink>
        <SegLink href={`${base}?status=rejected&type=${mediaType}`} active={status === 'rejected'}>
          Rejected {counts.rejected}
        </SegLink>
      </SegGroup>
      <span className="mx-1 h-5 w-px bg-border" />
      <SegGroup>
        <SegLink href={`${base}?status=${status}&type=all`} active={mediaType === 'all'}>
          All
        </SegLink>
        <SegLink href={`${base}?status=${status}&type=photo`} active={mediaType === 'photo'}>
          Photos
        </SegLink>
        <SegLink href={`${base}?status=${status}&type=video`} active={mediaType === 'video'}>
          Videos
        </SegLink>
      </SegGroup>
    </div>
  )
}

function SegGroup({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex rounded-lg border border-border bg-card p-1">{children}</div>
}

function SegLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
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

function ModerationCard({
  item,
  selected,
  onToggle,
  onApprove,
  onReject,
  onRestore,
}: {
  item: QueueItem
  selected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  onRestore: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbUrl}
            alt={`Upload from ${item.uploaderName ?? 'a guest'}`}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {item.mediaType === 'video' ? <PlayIcon className="size-7" /> : <ImageIcon className="size-7" />}
          </div>
        )}

        {item.mediaType === 'video' && item.thumbUrl && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
              <PlayIcon className="size-5" />
            </span>
          </span>
        )}
        {item.durationLabel && (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 text-caption font-medium tabular-nums text-white">
            {item.durationLabel}
          </span>
        )}

        <button
          type="button"
          aria-pressed={selected}
          aria-label={selected ? 'Deselect' : 'Select'}
          onClick={onToggle}
          className={
            'absolute top-1.5 left-1.5 inline-flex size-7 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ' +
            (selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-white/70 bg-black/30 text-transparent backdrop-blur-sm hover:bg-black/45')
          }
        >
          <CheckIcon className="size-4" />
        </button>

        {item.status !== 'pending' && (
          <div className="absolute top-1.5 right-1.5">
            <StatusPill status={item.status} />
          </div>
        )}
      </div>

      <CardContent className="space-y-3 py-3">
        <div className="min-w-0 text-caption text-muted-foreground">
          <p className="truncate font-medium text-foreground">{item.uploaderName ?? 'Guest'}</p>
          <p className="truncate">
            {item.mediaType === 'video' ? 'Video' : 'Photo'} · {item.sizeLabel} · {item.timeLabel}
          </p>
        </div>

        {item.status === 'pending' ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onReject}>
              <CloseIcon className="size-4" /> Reject
            </Button>
            <Button size="sm" className="flex-1" onClick={onApprove}>
              <CheckIcon className="size-4" /> Approve
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full" onClick={onRestore}>
            <RetryIcon className="size-4" /> Move to pending
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

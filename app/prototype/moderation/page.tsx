'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  MediaGrid,
  MediaTile,
  Skeleton,
  StatusPill,
} from '@/components/ui'
import { CheckIcon, CloseIcon, InboxIcon } from '@/components/ui/icons'
import { UPLOADS, thumbFor, type MockUpload } from '../mock'
import { ProtoBar } from '../ProtoBar'

type StatusFilter = 'pending' | 'approved' | 'rejected'
type TypeFilter = 'all' | 'photo' | 'video'

export default function ModerationPrototype() {
  const [items, setItems] = useState<MockUpload[]>(() => UPLOADS.map((u) => ({ ...u })))
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const counts = useMemo(
    () => ({
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    }),
    [items],
  )

  const visible = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === statusFilter)
    .filter(({ item }) => typeFilter === 'all' || item.type === typeFilter)

  function decide(ids: string[], status: 'approved' | 'rejected') {
    setItems((prev) => prev.map((it) => (ids.includes(it.id) ? { ...it, status } : it)))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedHere = visible.filter(({ item }) => selected.has(item.id)).map(({ item }) => item.id)

  return (
    <div className="min-h-screen bg-background pb-24">
      <ProtoBar title="Moderation queue">
        <Button size="sm" variant="ghost" onClick={() => setLoading((l) => !l)}>
          {loading ? 'Show queue' : 'Preview loading'}
        </Button>
      </ProtoBar>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <h1 className="font-display text-h1 text-foreground">Moderation</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {counts.pending} waiting · {counts.approved} approved · {counts.rejected} rejected
        </p>

        {/* Filters */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Segmented
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: 'pending', label: `Pending ${counts.pending}` },
              { value: 'approved', label: `Approved ${counts.approved}` },
              { value: 'rejected', label: `Rejected ${counts.rejected}` },
            ]}
          />
          <span className="mx-1 h-5 w-px bg-border" />
          <Segmented
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'photo', label: 'Photos' },
              { value: 'video', label: 'Videos' },
            ]}
          />
        </div>

        {/* Grid / states */}
        {loading ? (
          <MediaGrid className="mt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </MediaGrid>
        ) : visible.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<InboxIcon className="size-6" />}
              title={statusFilter === 'pending' ? 'All caught up' : `No ${statusFilter} items`}
              description={
                statusFilter === 'pending'
                  ? 'Every upload has been reviewed. New guest uploads will appear here.'
                  : 'Try a different filter to see more.'
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map(({ item, index }) => (
              <ModerationCard
                key={item.id}
                item={item}
                index={index}
                showPill={statusFilter !== 'pending'}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onApprove={() => decide([item.id], 'approved')}
                onReject={() => decide([item.id], 'rejected')}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bulk action bar */}
      {selectedHere.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
            <span className="text-body-sm font-medium text-foreground">
              {selectedHere.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => decide(selectedHere, 'rejected')}
              >
                <CloseIcon className="size-4" /> Reject all
              </Button>
              <Button size="sm" onClick={() => decide(selectedHere, 'approved')}>
                <CheckIcon className="size-4" /> Approve all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ModerationCard({
  item,
  index,
  showPill,
  selected,
  onToggle,
  onApprove,
  onReject,
}: {
  item: MockUpload
  index: number
  showPill: boolean
  selected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <MediaTile
        src={thumbFor(index)}
        alt={`Upload from ${item.uploader ?? 'a guest'}`}
        type={item.type}
        durationLabel={item.duration}
        status={showPill ? item.status : undefined}
        selected={selected}
        onToggleSelect={onToggle}
        className="rounded-none"
      />
      <CardContent className="space-y-3 py-3">
        <div className="min-w-0 text-caption text-muted-foreground">
          <p className="truncate font-medium text-foreground">{item.uploader ?? 'Guest'}</p>
          <p className="truncate">
            {item.type === 'video' ? 'Video' : 'Photo'} · {item.sizeLabel} · {item.timeLabel}
          </p>
        </div>
        {item.status === 'pending' ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onReject} aria-label="Reject">
              <CloseIcon className="size-4" /> Reject
            </Button>
            <Button size="sm" className="flex-1" onClick={onApprove} aria-label="Approve">
              <CheckIcon className="size-4" /> Approve
            </Button>
          </div>
        ) : (
          <StatusPill status={item.status} />
        )}
      </CardContent>
    </Card>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={
            'rounded-md px-3 py-1.5 text-caption font-medium transition-colors ' +
            (value === o.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

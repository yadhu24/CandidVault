'use client'

import { useMemo, useState } from 'react'
import {
  Badge,
  EmptyState,
  MediaGrid,
  MediaTile,
  Modal,
  StatusPill,
} from '@/components/ui'
import { ImageIcon } from '@/components/ui/icons'
import { UPLOADS, thumbFor, type MockUpload } from '../mock'
import { ProtoBar } from '../ProtoBar'

type TypeFilter = 'all' | 'photo' | 'video'
type Sort = 'newest' | 'oldest'

const APPROVED = UPLOADS.map((u, i) => ({ ...u, status: 'approved' as const, _thumb: i }))

export default function GalleryPrototype() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [preview, setPreview] = useState<(MockUpload & { _thumb: number }) | null>(null)

  const visible = useMemo(() => {
    const list = APPROVED.filter((u) => typeFilter === 'all' || u.type === typeFilter)
    return sort === 'oldest' ? [...list].reverse() : list
  }, [typeFilter, sort])

  return (
    <div className="min-h-screen bg-background">
      <ProtoBar title="Approved gallery" />

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1 text-foreground">Gallery</h1>
            <p className="mt-1 text-body-sm text-muted-foreground">{visible.length} approved</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'photo', label: 'Photos' },
                { value: 'video', label: 'Videos' },
              ]}
            />
            <Segmented
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
              ]}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<ImageIcon className="size-6" />}
              title="Nothing here yet"
              description="Approved photos and videos will show up in the gallery."
            />
          </div>
        ) : (
          <MediaGrid className="mt-6">
            {visible.map((u) => (
              <MediaTile
                key={u.id}
                src={thumbFor(u._thumb)}
                alt={`Photo from ${u.uploader ?? 'a guest'}`}
                type={u.type}
                durationLabel={u.duration}
                onClick={() => setPreview(u)}
              />
            ))}
          </MediaGrid>
        )}
      </main>

      <Modal open={preview !== null} onClose={() => setPreview(null)} className="max-w-lg">
        {preview && (
          <div>
            <div className="overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbFor(preview._thumb)}
                alt={`Photo from ${preview.uploader ?? 'a guest'}`}
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{preview.uploader ?? 'Guest'}</p>
                <p className="text-caption text-muted-foreground">
                  {preview.type === 'video' ? 'Video' : 'Photo'} · {preview.sizeLabel} ·{' '}
                  {preview.timeLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {preview.type === 'video' && <Badge variant="info">Video</Badge>}
                <StatusPill status="approved" />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
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

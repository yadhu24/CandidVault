'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui'
import {
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MapPinIcon,
} from '@/components/ui/icons'
import { EVENT } from '../mock'
import { ProtoBar } from '../ProtoBar'

const TABS = ['Overview', 'Uploads', 'Gallery', 'Albums', 'Export', 'Settings'] as const
type Tab = (typeof TABS)[number]

const uploadUrl = `https://candidvault.org/e/${EVENT.slug}`

export default function EventDetailPrototype() {
  const [tab, setTab] = useState<Tab>('Overview')
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(uploadUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="min-h-screen bg-background">
      <ProtoBar title="Event detail" />

      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 pt-6 pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-h1 text-foreground">{EVENT.name}</h1>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" /> {EVENT.date}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" /> {EVENT.venue}
            </span>
          </div>

          <nav className="mt-5 -mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  'shrink-0 border-b-2 px-3 py-2.5 text-body-sm font-medium transition-colors ' +
                  (t === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {tab === 'Overview' ? (
          <Overview onCopy={copy} copied={copied} />
        ) : tab === 'Uploads' ? (
          <TabLink
            title="Moderation queue"
            body="Review and approve guest uploads."
            href="/prototype/moderation"
          />
        ) : tab === 'Gallery' ? (
          <TabLink
            title="Approved gallery"
            body="Browse everything you've approved."
            href="/prototype/gallery"
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center text-body-sm text-muted-foreground">
            {tab} — designed next.
          </div>
        )}
      </main>
    </div>
  )
}

function Overview({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Scans" value={EVENT.scans} />
          <StatCard label="Uploads" value={EVENT.uploads} />
          <StatCard label="Approved" value={EVENT.approved} />
          <StatCard label="Exports" value={EVENT.exports} />
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-h3 text-foreground">Needs your attention</h2>
            <Link
              href="/prototype/moderation"
              className="text-body-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open queue
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg bg-warning-subtle px-4 py-3">
              <span className="text-body-sm text-warning-subtle-foreground">
                {EVENT.pending} uploads waiting for review
              </span>
              <Button size="sm" variant="outline">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR card */}
      <Card>
        <CardHeader>
          <h2 className="text-h3 text-foreground">Guest upload QR</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-4">
            <FauxQR className="size-44 text-sand-900" />
          </div>
          <code className="block truncate rounded-md bg-muted px-3 py-2 text-caption text-muted-foreground">
            {uploadUrl}
          </code>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCopy}>
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button variant="outline" className="flex-1">
              <DownloadIcon className="size-4" /> QR PNG
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">
            Print it or show it on a screen — guests scan to upload.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="font-display text-title tabular-nums text-foreground">{value}</p>
        <p className="text-overline uppercase text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function TabLink({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h2 className="text-h3 text-foreground">{title}</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">{body}</p>
        </div>
        <Link href={href}>
          <Button>Open prototype</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// Decorative QR stand-in (the real page renders a scannable code via lib/qr).
function FauxQR({ className }: { className?: string }) {
  const N = 25
  const finder = (x: number, y: number) => {
    const at = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7
    return at(0, 0) || at(N - 7, 0) || at(0, N - 7)
  }
  const on = (x: number, y: number) => (x * 7 + y * 13 + x * y * 3) % 5 < 2
  const modules: React.ReactNode[] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue
      if (on(x, y)) modules.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
    }
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className={className} fill="currentColor" shapeRendering="crispEdges" role="img" aria-label="QR code preview">
      {modules}
      <FinderPattern x={0} y={0} />
      <FinderPattern x={N - 7} y={0} />
      <FinderPattern x={0} y={N - 7} />
    </svg>
  )
}

function FinderPattern({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={7} height={7} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} />
    </>
  )
}

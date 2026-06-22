'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button, Dropzone, UploadProgressItem, type UploadItemStatus } from '@/components/ui'
import {
  AlertIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  MapPinIcon,
  SparkleIcon,
} from '@/components/ui/icons'
import { EVENT, thumbFor } from '../mock'

type Screen = 'landing' | 'uploading' | 'closed' | 'invalid'

interface Item {
  id: string
  name: string
  sizeLabel: string
  type: 'photo' | 'video'
  thumbUrl?: string
  status: UploadItemStatus
  progress: number
  error?: string
  speed: number
  willFail: boolean
  finalizedAt?: number
}

const FAIL_MESSAGE = 'Weak signal — tap to retry'
let counter = 0
const uid = () => `f${++counter}`

function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// Pure per-tick transform: advance uploads, settle finalizing items to done/error.
function advance(prev: Item[]): Item[] {
  return prev.map((it) => {
    if (it.status === 'uploading') {
      const p = it.progress + it.speed
      return p >= 100
        ? { ...it, progress: 100, status: 'finalizing', finalizedAt: Date.now() }
        : { ...it, progress: p }
    }
    if (it.status === 'finalizing' && Date.now() - (it.finalizedAt ?? 0) > 650) {
      return it.willFail
        ? { ...it, status: 'error', error: FAIL_MESSAGE }
        : { ...it, status: 'done' }
    }
    return it
  })
}

export default function GuestUploadPrototype() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [items, setItems] = useState<Item[]>([])
  const [doneForNow, setDoneForNow] = useState(false)
  const [lifetimeUploaded, setLifetimeUploaded] = useState(0)
  const objectUrls = useRef<string[]>([])

  const anyActive = items.some((i) => i.status === 'uploading' || i.status === 'finalizing')
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const allSettled = items.length > 0 && doneCount + errorCount === items.length
  const showSuccess = screen === 'uploading' && items.length > 0 && (doneCount === items.length || doneForNow)

  // Drive the simulated uploads while any file is in flight.
  useEffect(() => {
    if (!anyActive) return
    const iv = setInterval(() => setItems(advance), 180)
    return () => clearInterval(iv)
  }, [anyActive])

  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  function startBatch(newItems: Item[]) {
    setDoneForNow(false)
    setItems((prev) => [...prev, ...newItems])
    setScreen('uploading')
  }

  function onFiles(files: File[]) {
    const created: Item[] = files.map((file) => {
      const isVideo = file.type.startsWith('video/')
      let thumbUrl: string | undefined
      if (!isVideo && file.size > 0) {
        thumbUrl = URL.createObjectURL(file)
        objectUrls.current.push(thumbUrl)
      }
      return {
        id: uid(),
        name: file.name,
        sizeLabel: fmtSize(file.size),
        type: isVideo ? 'video' : 'photo',
        thumbUrl,
        status: 'uploading',
        progress: 0,
        speed: 9 + Math.random() * 11,
        // Fail ~1 in 4 so error + retry is part of the demo.
        willFail: Math.random() < 0.25,
      }
    })
    // Guarantee at least one failure when several files are picked.
    if (created.length >= 3 && !created.some((c) => c.willFail)) created[1].willFail = true
    startBatch(created)
  }

  function retry(id: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, status: 'uploading', progress: 0, error: undefined, willFail: false }
          : it,
      ),
    )
  }

  function retryAll() {
    setItems((prev) =>
      prev.map((it) =>
        it.status === 'error'
          ? { ...it, status: 'uploading', progress: 0, error: undefined, willFail: false }
          : it,
      ),
    )
  }

  function addMore() {
    setLifetimeUploaded((n) => n + doneCount)
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u))
    objectUrls.current = []
    setItems([])
    setDoneForNow(false)
    setScreen('landing')
  }

  // Prototype-only: pre-populate an in-flight / settled batch for quick preview.
  function demoUploading() {
    setScreen('uploading')
    setDoneForNow(false)
    setItems([
      { id: uid(), name: 'IMG_4821.jpg', sizeLabel: '3.1 MB', type: 'photo', thumbUrl: thumbFor(3), status: 'uploading', progress: 64, speed: 6, willFail: false },
      { id: uid(), name: 'sangeet-clip.mov', sizeLabel: '22.4 MB', type: 'video', status: 'uploading', progress: 28, speed: 4, willFail: false },
      { id: uid(), name: 'DSC_0093.jpg', sizeLabel: '2.4 MB', type: 'photo', thumbUrl: thumbFor(7), status: 'done', progress: 100, speed: 8, willFail: false },
      { id: uid(), name: 'IMG_4830.jpg', sizeLabel: '4.0 MB', type: 'photo', thumbUrl: thumbFor(0), status: 'error', progress: 100, speed: 8, willFail: true, error: FAIL_MESSAGE },
    ])
  }

  if (screen === 'closed') return <Shell><ClosedState onReset={() => setScreen('landing')} /></Shell>
  if (screen === 'invalid') return <Shell><InvalidState onReset={() => setScreen('landing')} /></Shell>

  return (
    <Shell>
      {screen === 'landing' && (
        <Landing lifetimeUploaded={lifetimeUploaded} onFiles={onFiles} />
      )}

      {screen === 'uploading' && showSuccess && (
        <Success
          doneCount={doneCount + lifetimeUploaded}
          failed={errorCount}
          items={items}
          onAddMore={addMore}
          onRetryRest={() => setDoneForNow(false)}
        />
      )}

      {screen === 'uploading' && !showSuccess && (
        <Uploading
          items={items}
          doneCount={doneCount}
          errorCount={errorCount}
          allSettled={allSettled}
          onRetry={retry}
          onRetryAll={retryAll}
          onDoneForNow={() => setDoneForNow(true)}
        />
      )}

      <StateSwitcher
        onLanding={addMore}
        onUploading={demoUploading}
        onClosed={() => setScreen('closed')}
        onInvalid={() => setScreen('invalid')}
      />
    </Shell>
  )
}

/* ---------- Layout shell (phone-width, full height) ---------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-8 pb-6">{children}</div>
    </div>
  )
}

function EventHeader() {
  return (
    <div className="text-center">
      <p className="text-overline uppercase text-primary">You’re invited to share</p>
      <h1 className="mt-1 font-display text-title text-foreground">{EVENT.name}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="size-3.5" /> {EVENT.date}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3.5" /> {EVENT.venue}
        </span>
      </div>
    </div>
  )
}

/* ---------- Landing ---------- */
function Landing({ lifetimeUploaded, onFiles }: { lifetimeUploaded: number; onFiles: (f: File[]) => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <EventHeader />

      <div className="mt-8 flex-1">
        <Dropzone
          onFiles={onFiles}
          accept="image/*,video/*"
          capture="environment"
          icon={<CameraIcon className="size-7" />}
          title="Add your photos & videos"
          hint="Tap to choose from your gallery or take a new one"
          className="min-h-56"
        />

        <p className="mt-4 text-center text-body-sm text-muted-foreground">
          No app, no sign-up — your moments go straight to the couple.
        </p>

        {lifetimeUploaded > 0 && (
          <p className="mt-3 text-center text-caption font-medium text-success">
            You’ve shared {lifetimeUploaded} so far — thank you!
          </p>
        )}

        <ul className="mt-8 space-y-3">
          <Reassure>Pick as many as you like — they upload together.</Reassure>
          <Reassure>On a weak signal it keeps trying. Nothing is lost.</Reassure>
          <Reassure>Come back to this page anytime to add more.</Reassure>
        </ul>
      </div>
    </div>
  )
}

function Reassure({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-body-sm text-foreground">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
        <CheckIcon className="size-3.5" />
      </span>
      {children}
    </li>
  )
}

/* ---------- Uploading ---------- */
function Uploading({
  items,
  doneCount,
  errorCount,
  allSettled,
  onRetry,
  onRetryAll,
  onDoneForNow,
}: {
  items: Item[]
  doneCount: number
  errorCount: number
  allSettled: boolean
  onRetry: (id: string) => void
  onRetryAll: () => void
  onDoneForNow: () => void
}) {
  const total = items.length
  const needsAttention = allSettled && errorCount > 0
  const pct = Math.round((doneCount / total) * 100)

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <h1 className="font-display text-h1 text-foreground">
          {needsAttention ? 'Almost there' : 'Uploading your memories'}
        </h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {needsAttention
            ? `${errorCount} of ${total} need another try — everything else is in.`
            : `${doneCount} of ${total} uploaded`}
        </p>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-5 flex-1 space-y-2 overflow-y-auto">
        {items.map((it) => (
          <UploadProgressItem
            key={it.id}
            name={it.name}
            status={it.status}
            progress={it.progress}
            error={it.error}
            thumbnailUrl={it.thumbUrl}
            onRetry={it.status === 'error' ? () => onRetry(it.id) : undefined}
          />
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {!allSettled && (
          <p className="rounded-xl bg-muted px-4 py-3 text-center text-caption text-muted-foreground">
            Keep this page open. You can finish later — already-uploaded photos are safe.
          </p>
        )}
        {needsAttention && (
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={onDoneForNow}>
              Done for now
            </Button>
            <Button size="lg" className="flex-1" onClick={onRetryAll}>
              Retry {errorCount}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Success ---------- */
function Success({
  doneCount,
  failed,
  items,
  onAddMore,
  onRetryRest,
}: {
  doneCount: number
  failed: number
  items: Item[]
  onAddMore: () => void
  onRetryRest: () => void
}) {
  const thumbs = items.filter((i) => i.status === 'done' && i.thumbUrl).slice(0, 5)
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative flex size-20 items-center justify-center rounded-full bg-success-subtle text-success">
        <CheckIcon className="size-10" />
        <SparkleIcon className="absolute -top-1 -right-1 size-6 text-gold-500" />
      </div>

      <h1 className="mt-6 font-display text-title text-foreground">
        {doneCount} uploaded
      </h1>
      <p className="mt-2 max-w-xs text-body text-muted-foreground">
        Thank you for sharing with {EVENT.name}. You can add more anytime — it’s safe to close this page.
      </p>

      {thumbs.length > 0 && (
        <div className="mt-6 flex -space-x-3">
          {thumbs.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.id}
              src={t.thumbUrl}
              alt=""
              className="size-12 rounded-lg border-2 border-card object-cover shadow-sm"
            />
          ))}
        </div>
      )}

      {failed > 0 && (
        <button
          onClick={onRetryRest}
          className="mt-6 text-body-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {failed} didn’t go through — try again
        </button>
      )}

      <div className="mt-8 w-full">
        <Button size="lg" className="w-full" onClick={onAddMore}>
          <CameraIcon className="size-5" /> Add more photos
        </Button>
      </div>
    </div>
  )
}

/* ---------- Closed / Invalid ---------- */
function ClosedState({ onReset }: { onReset: () => void }) {
  return (
    <CenteredMessage
      tone="muted"
      icon={<CalendarIcon className="size-8" />}
      title="Uploads are closed"
      body={`${EVENT.name} isn't accepting new photos right now. Thank you for celebrating with them.`}
      onReset={onReset}
    />
  )
}

function InvalidState({ onReset }: { onReset: () => void }) {
  return (
    <CenteredMessage
      tone="destructive"
      icon={<AlertIcon className="size-8" />}
      title="This link doesn't look right"
      body="Double-check the QR code, or ask the host for a fresh link to share your photos."
      onReset={onReset}
    />
  )
}

function CenteredMessage({
  tone,
  icon,
  title,
  body,
  onReset,
}: {
  tone: 'muted' | 'destructive'
  icon: React.ReactNode
  title: string
  body: string
  onReset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div
        className={
          tone === 'destructive'
            ? 'flex size-16 items-center justify-center rounded-full bg-destructive-subtle text-destructive-subtle-foreground'
            : 'flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground'
        }
      >
        {icon}
      </div>
      <h1 className="mt-6 font-display text-h1 text-foreground">{title}</h1>
      <p className="mt-2 max-w-xs text-body-sm text-muted-foreground">{body}</p>
      <button
        onClick={onReset}
        className="mt-8 text-caption font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to start (prototype)
      </button>
    </div>
  )
}

/* ---------- Prototype-only state switcher ---------- */
function StateSwitcher({
  onLanding,
  onUploading,
  onClosed,
  onInvalid,
}: {
  onLanding: () => void
  onUploading: () => void
  onClosed: () => void
  onInvalid: () => void
}) {
  const btn =
    'rounded-full border border-border px-3 py-1 text-caption text-muted-foreground hover:bg-muted'
  return (
    <div className="mt-8 border-t border-dashed border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted-foreground">Prototype — preview states</span>
        <Link href="/prototype" className="text-caption text-primary underline-offset-4 hover:underline">
          All screens
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={btn} onClick={onLanding}>Landing</button>
        <button className={btn} onClick={onUploading}>Uploading + error</button>
        <button className={btn} onClick={onClosed}>Closed</button>
        <button className={btn} onClick={onInvalid}>Invalid link</button>
      </div>
    </div>
  )
}

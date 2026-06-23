'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Dropzone, Input, UploadProgressItem } from '@/components/ui'
import { CameraIcon, CheckIcon, SparkleIcon } from '@/components/ui/icons'
import { trackClient } from '@/lib/analytics/client'
import { compressImage } from '@/lib/uploads/compress-client'
import { isAllowedMimeType, maxBytesForMime } from '@/lib/validation/media'

const ACCEPT = 'image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime'

type ItemStatus = 'queued' | 'uploading' | 'finalizing' | 'done' | 'error'

// In-session multipart resume state: which parts already uploaded (by ETag).
interface MultipartState {
  ticket: string
  partSize: number
  total: number
  done: Record<number, string>
}

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  progress: number
  error?: string
  thumbUrl?: string
  mp?: MultipartState
}

class TicketExpiredError extends Error {}

const pctOf = (bytes: number, total: number) => Math.min(100, Math.round((bytes / total) * 100))
const partLen = (file: File, partSize: number, n: number) =>
  Math.min(partSize, file.size - (n - 1) * partSize)

// --- network helpers ------------------------------------------------------

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    return (await res.json())?.error?.message ?? fallback
  } catch {
    return fallback
  }
}
async function readErrorCode(res: Response): Promise<string | null> {
  try {
    return (await res.clone().json())?.error?.code ?? null
  } catch {
    return null
  }
}

// Single PUT (small files); pins Content-Type to match the signed URL.
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (HTTP ${xhr.status})`))
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload was interrupted'))
    xhr.send(file)
  })
}

// One multipart part; returns its ETag (needs R2 CORS ExposeHeaders: ETag).
function putPartWithProgress(
  url: string,
  blob: Blob,
  onLoaded: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag')
        if (etag) resolve(etag)
        else reject(new Error('Missing ETag — check R2 CORS ExposeHeaders'))
      } else reject(new Error(`Part failed (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new Error('Upload was interrupted'))
    xhr.send(blob)
  })
}

// --- finish-later reminder (cross-session, best-effort localStorage) -------

const pendingKey = (slug: string) => `cv:pending:${slug}`
function loadPending(slug: string): string[] {
  try {
    const raw = localStorage.getItem(pendingKey(slug))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return [] // localStorage may be unavailable (private mode); reminder is optional.
  }
}
function writePending(slug: string, names: string[]): void {
  try {
    localStorage.setItem(pendingKey(slug), JSON.stringify(names))
  } catch {
    // best-effort only
  }
}
const addPending = (slug: string, name: string) =>
  writePending(slug, Array.from(new Set([...loadPending(slug), name])))
const removePending = (slug: string, name: string) =>
  writePending(slug, loadPending(slug).filter((n) => n !== name))

// ==========================================================================

export function GuestUploader({
  slug,
  eventId,
  eventName,
}: {
  slug: string
  eventId?: string
  eventName?: string
}) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const [objectUrls] = useState<string[]>(() => [])
  const [dismissedReminder, setDismissedReminder] = useState(false)

  useEffect(() => () => objectUrls.forEach((u) => URL.revokeObjectURL(u)), [objectUrls])

  // Read prior-session unfinished files once, after hydration (no SSR mismatch).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const priorPending = useMemo(() => (hydrated ? loadPending(slug) : []), [hydrated, slug])
  const showReminder = hydrated && !dismissedReminder && priorPending.length > 0

  const patch = (id: string, next: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)))

  // --- API calls (slug + name captured) ---
  async function initiate(file: File) {
    const res = await fetch(`/api/e/${slug}/upload-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        uploaderName: name.trim() || undefined,
      }),
    })
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not start the upload.'))
    return (await res.json()) as
      | { mode: 'single'; uploadUrl: string; ticket: string }
      | { mode: 'multipart'; partSize: number; ticket: string }
  }

  async function presignParts(ticket: string, partNumbers: number[]) {
    const res = await fetch(`/api/e/${slug}/upload-parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, partNumbers }),
    })
    if (!res.ok) {
      if ((await readErrorCode(res)) === 'INVALID_TICKET') throw new TicketExpiredError()
      throw new Error(await readErrorMessage(res, 'Upload preparation failed.'))
    }
    return (await res.json()).urls as Record<number, string>
  }

  async function confirm(ticket: string, parts?: { partNumber: number; etag: string }[]) {
    const res = await fetch(`/api/e/${slug}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parts ? { ticket, parts } : { ticket }),
    })
    if (!res.ok) {
      if ((await readErrorCode(res)) === 'INVALID_TICKET') throw new TicketExpiredError()
      throw new Error(await readErrorMessage(res, 'Could not finalize the upload.'))
    }
  }

  async function runUpload(item: UploadItem) {
    const { id, file } = item
    patch(id, { status: 'uploading', error: undefined })

    let mp = item.mp
    if (!mp) {
      const res = await initiate(file)
      if (res.mode === 'single') {
        await putWithProgress(res.uploadUrl, file, (pct) => patch(id, { progress: pct }))
        patch(id, { status: 'finalizing', progress: 100 })
        await confirm(res.ticket)
        finishDone(id, file.name)
        return
      }
      mp = {
        ticket: res.ticket,
        partSize: res.partSize,
        total: Math.max(1, Math.ceil(file.size / res.partSize)),
        done: {},
      }
      patch(id, { mp })
    }

    // Upload only the parts we don't already have (this is the resume).
    let uploadedBytes = 0
    const missing: number[] = []
    for (let n = 1; n <= mp.total; n++) {
      if (mp.done[n]) uploadedBytes += partLen(file, mp.partSize, n)
      else missing.push(n)
    }

    if (missing.length > 0) {
      const urls = await presignParts(mp.ticket, missing)
      for (const n of missing) {
        const blob = file.slice((n - 1) * mp.partSize, Math.min(n * mp.partSize, file.size))
        const onLoaded = (loaded: number) =>
          patch(id, { progress: pctOf(uploadedBytes + loaded, file.size) })
        let etag: string
        try {
          etag = await putPartWithProgress(urls[n], blob, onLoaded)
        } catch {
          // Re-presign just this part and retry once (covers a dropped chunk).
          const fresh = await presignParts(mp.ticket, [n])
          etag = await putPartWithProgress(fresh[n], blob, onLoaded)
        }
        uploadedBytes += blob.size
        mp.done[n] = etag
        patch(id, { mp: { ...mp }, progress: pctOf(uploadedBytes, file.size) })
      }
    }

    patch(id, { status: 'finalizing', progress: 100 })
    await confirm(
      mp.ticket,
      Object.entries(mp.done).map(([n, etag]) => ({ partNumber: Number(n), etag })),
    )
    finishDone(id, file.name)
  }

  async function upload(item: UploadItem) {
    try {
      await runUpload(item)
    } catch (err) {
      if (err instanceof TicketExpiredError) {
        // Upload window lapsed (e.g. resumed much later): restart this file fresh.
        patch(item.id, { mp: undefined, progress: 0 })
        try {
          await runUpload({ ...item, mp: undefined })
          return
        } catch (retryErr) {
          fail(item.id, retryErr)
          return
        }
      }
      fail(item.id, err)
    }
  }

  function finishDone(id: string, fileName: string) {
    patch(id, { status: 'done' })
    removePending(slug, fileName)
  }
  function fail(id: string, err: unknown) {
    patch(id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
  }

  function buildItem(file: File): UploadItem {
    const id = crypto.randomUUID()
    if (!isAllowedMimeType(file.type)) {
      return { id, file, status: 'error', progress: 0, error: 'Unsupported file type' }
    }
    if (file.size > maxBytesForMime(file.type)) {
      return { id, file, status: 'error', progress: 0, error: 'File is too large' }
    }
    let thumbUrl: string | undefined
    if (file.type.startsWith('image/')) {
      thumbUrl = URL.createObjectURL(file)
      objectUrls.push(thumbUrl)
    }
    return { id, file, status: 'queued', progress: 0, thumbUrl }
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    // Sequential keeps memory + bandwidth predictable on phones.
    for (const raw of files) {
      const file = await compressImage(raw) // skips HEIC/video; cuts payload otherwise
      const item = buildItem(file)
      setItems((prev) => [...prev, item])
      if (item.status === 'queued') {
        addPending(slug, file.name)
        trackClient('upload_started', {
          eventId,
          properties: { mediaType: file.type.startsWith('video/') ? 'video' : 'photo' },
        })
        await upload(item)
      }
    }
  }

  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const errored = items.filter((i) => i.status === 'error').length
  const active = items.some((i) => ['queued', 'uploading', 'finalizing'].includes(i.status))
  const allDone = total > 0 && done === total

  if (total === 0) {
    return (
      <div className="space-y-5">
        {showReminder && (
          <ReminderBanner names={priorPending} onDismiss={() => setDismissedReminder(true)} />
        )}
        <Input
          id="uploaderName"
          label="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoComplete="name"
          placeholder="So the couple knows who shared"
        />
        <Dropzone
          onFiles={handleFiles}
          accept={ACCEPT}
          icon={<CameraIcon className="size-7" />}
          title="Add your photos & videos"
          hint="JPEG, PNG, HEIC, WebP, MP4 or MOV"
          className="min-h-56"
        />
        <ul className="space-y-3">
          <Reassure>Pick as many as you like — they upload together.</Reassure>
          <Reassure>Patchy signal? It keeps retrying and resumes where it left off.</Reassure>
          <Reassure>Leave and finish from home anytime — your link stays active.</Reassure>
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {allDone ? (
        <div className="text-center">
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckIcon className="size-9" />
            <SparkleIcon className="absolute -top-1 -right-1 size-5 text-gold-500" />
          </div>
          <h2 className="mt-4 font-display text-h1 text-foreground">{done} uploaded</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Thank you for sharing{eventName ? ` with ${eventName}` : ''} — it&apos;s safe to close
            this page.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="font-display text-h2 text-foreground">
            {!active && errored > 0 ? 'Almost there' : 'Uploading your memories'}
          </h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {!active && errored > 0
              ? `${errored} didn’t upload — tap retry. Everything else is in.`
              : `${done} of ${total} uploaded`}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <UploadProgressItem
            key={item.id}
            name={item.file.name}
            status={item.status}
            progress={item.progress}
            error={item.error}
            thumbnailUrl={item.thumbUrl}
            onRetry={item.status === 'error' ? () => upload(item) : undefined}
          />
        ))}
      </ul>

      {active && (
        <p className="rounded-xl bg-muted px-4 py-3 text-center text-caption text-muted-foreground">
          Lost signal? It resumes automatically — and you can finish later from home.
        </p>
      )}

      <Dropzone
        onFiles={handleFiles}
        accept={ACCEPT}
        icon={<CameraIcon className="size-5" />}
        title={allDone ? 'Add more photos & videos' : 'Add more'}
        className="min-h-0 py-6"
      />
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

function ReminderBanner({ names, onDismiss }: { names: string[]; onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-warning-border bg-warning-subtle px-4 py-3 text-warning-subtle-foreground">
      <p className="text-body-sm font-medium">Welcome back — finish your upload</p>
      <p className="mt-0.5 text-caption">
        {names.length} {names.length === 1 ? 'photo' : 'photos'} didn’t finish last time. Add{' '}
        {names.length === 1 ? 'it' : 'them'} again below to complete — anything already uploaded is
        safe.
      </p>
      <button
        onClick={onDismiss}
        className="mt-2 text-caption font-medium underline underline-offset-4"
      >
        Dismiss
      </button>
    </div>
  )
}

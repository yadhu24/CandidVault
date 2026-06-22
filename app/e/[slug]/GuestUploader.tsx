'use client'

import { useEffect, useRef, useState } from 'react'
import { Dropzone, Input, UploadProgressItem } from '@/components/ui'
import { CameraIcon, CheckIcon, SparkleIcon } from '@/components/ui/icons'
import { isAllowedMimeType, maxBytesForMime } from '@/lib/validation/media'

// Same set the server validates against; also drives the native picker filter.
const ACCEPT = 'image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime'

type ItemStatus = 'queued' | 'uploading' | 'finalizing' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  progress: number
  error?: string
  thumbUrl?: string
}

// fetch() can't report upload progress, so the direct-to-R2 PUT uses XHR.
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
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

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return body?.error?.message ?? fallback
  } catch {
    return fallback
  }
}

export function GuestUploader({ slug, eventName }: { slug: string; eventName?: string }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const objectUrls = useRef<string[]>([])

  // Release any image preview URLs when the page unmounts.
  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const patch = (id: string, next: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)))

  async function upload(item: UploadItem) {
    const { id, file } = item
    try {
      patch(id, { status: 'uploading', progress: 0, error: undefined })

      const sessionRes = await fetch(`/api/e/${slug}/upload-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
          uploaderName: name.trim() || undefined,
        }),
      })
      if (!sessionRes.ok) {
        throw new Error(await readErrorMessage(sessionRes, 'Could not start the upload.'))
      }
      const { uploadUrl, ticket } = (await sessionRes.json()) as {
        uploadUrl: string
        ticket: string
      }

      await putWithProgress(uploadUrl, file, (percent) => patch(id, { progress: percent }))

      patch(id, { status: 'finalizing', progress: 100 })
      const confirmRes = await fetch(`/api/e/${slug}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      })
      if (!confirmRes.ok) {
        throw new Error(await readErrorMessage(confirmRes, 'Could not finalize the upload.'))
      }

      patch(id, { status: 'done' })
    } catch (err) {
      patch(id, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
    }
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
      objectUrls.current.push(thumbUrl)
    }
    return { id, file, status: 'queued', progress: 0, thumbUrl }
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    const accepted = files.map(buildItem)
    setItems((prev) => [...prev, ...accepted])

    // Sequential keeps memory + bandwidth predictable on phones.
    for (const item of accepted) {
      if (item.status === 'queued') await upload(item)
    }
  }

  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  const errored = items.filter((i) => i.status === 'error').length
  const active = items.some((i) => ['queued', 'uploading', 'finalizing'].includes(i.status))
  const allDone = total > 0 && done === total

  // Landing — set an optional name, then add files.
  if (total === 0) {
    return (
      <div className="space-y-5">
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
          <Reassure>On a weak signal it keeps trying. Nothing is lost.</Reassure>
          <Reassure>Come back to this page anytime to add more.</Reassure>
        </ul>
      </div>
    )
  }

  // In-progress / success.
  return (
    <div className="space-y-5">
      {allDone ? (
        <div className="text-center">
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-success-subtle text-success">
            <CheckIcon className="size-9" />
            <SparkleIcon className="absolute -top-1 -right-1 size-5 text-gold-500" />
          </div>
          <h2 className="mt-4 font-display text-h1 text-foreground">
            {done} uploaded
          </h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Thank you for sharing{eventName ? ` with ${eventName}` : ''} — it&apos;s safe to close this page.
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
          Keep this page open. You can finish later — uploaded photos are safe.
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

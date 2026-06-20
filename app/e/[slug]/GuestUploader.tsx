'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { isAllowedMimeType, maxBytesForMime } from '@/lib/validation/media'

type ItemStatus = 'queued' | 'uploading' | 'finalizing' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: ItemStatus
  progress: number
  error?: string
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

export function GuestUploader({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

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

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return

    const accepted: UploadItem[] = []
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()
      if (!isAllowedMimeType(file.type)) {
        accepted.push({ id, file, status: 'error', progress: 0, error: 'Unsupported file type' })
      } else if (file.size > maxBytesForMime(file.type)) {
        accepted.push({ id, file, status: 'error', progress: 0, error: 'File is too large' })
      } else {
        accepted.push({ id, file, status: 'queued', progress: 0 })
      }
    }
    setItems((prev) => [...prev, ...accepted])
    if (inputRef.current) inputRef.current.value = ''

    // Sequential keeps memory + bandwidth predictable on phones.
    for (const item of accepted) {
      if (item.status === 'queued') await upload(item)
    }
  }

  return (
    <div className="space-y-4">
      <Input
        id="uploaderName"
        label="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        autoComplete="name"
        placeholder="So the photographer knows who shared"
      />

      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-zinc-300 bg-white p-8 text-center hover:border-zinc-400">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime"
          multiple
          className="sr-only"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        <span className="block font-semibold text-zinc-900">Tap to add photos &amp; videos</span>
        <span className="mt-1 block text-sm text-zinc-500">JPEG, PNG, HEIC, WebP, MP4, or MOV</span>
      </label>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-zinc-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-zinc-700">{item.file.name}</span>
                <StatusLabel item={item} onRetry={() => upload(item)} />
              </div>
              {(item.status === 'uploading' || item.status === 'finalizing') && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full bg-zinc-900 transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.status === 'error' && item.error && (
                <p className="mt-1 text-xs text-red-500">{item.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusLabel({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  switch (item.status) {
    case 'uploading':
      return <span className="shrink-0 text-zinc-500">{item.progress}%</span>
    case 'finalizing':
      return <span className="shrink-0 text-zinc-500">Finishing…</span>
    case 'done':
      return <span className="shrink-0 font-medium text-green-600">Uploaded</span>
    case 'error':
      return (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      )
    default:
      return <span className="shrink-0 text-zinc-400">Queued</span>
  }
}

import { requirePhotographer } from '@/lib/account/photographers'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'
import { listUploadsForModeration } from '@/lib/db/queries/uploads'
import type { MediaType, ModerationStatus } from '@/lib/db/types'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { createDownloadPresignedUrl } from '@/lib/storage'
import { ModerationQueue, type QueueItem } from './ModerationQueue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; type?: string }>
}

const STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected']

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  return `${m}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

function formatRelative(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function EventUploadsPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const status: ModerationStatus = STATUSES.includes(sp.status as ModerationStatus)
    ? (sp.status as ModerationStatus)
    : 'pending'
  const mediaType: MediaType | undefined =
    sp.type === 'photo' || sp.type === 'video' ? sp.type : undefined
  const typeFilter = mediaType ?? 'all'

  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id) // ownership; notFound otherwise

  const [uploads, counts] = await Promise.all([
    listUploadsForModeration(event.id, { moderationStatus: status, mediaType }),
    countUploadsByModeration(event.id),
  ])

  // Presign thumbnails server-side; the storage key never reaches the client.
  const items: QueueItem[] = await Promise.all(
    uploads.map(async (u) => ({
      id: u.id,
      mediaType: u.mediaType,
      status: u.moderationStatus,
      sizeLabel: formatBytes(u.fileSizeBytes),
      timeLabel: formatRelative(u.createdAt),
      uploaderName: u.uploaderName,
      durationLabel: u.durationSeconds ? formatDuration(u.durationSeconds) : undefined,
      thumbUrl: u.thumbnailKey ? await createDownloadPresignedUrl(u.thumbnailKey) : null,
    })),
  )

  return (
    <ModerationQueue
      // Remounting per filter resets the selection set cleanly.
      key={`${status}-${typeFilter}`}
      eventId={event.id}
      status={status}
      mediaType={typeFilter}
      counts={counts}
      items={items}
    />
  )
}

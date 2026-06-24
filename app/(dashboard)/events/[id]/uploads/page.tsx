import { requirePhotographer } from '@/lib/account/photographers'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'
import { listUploadsForModeration } from '@/lib/db/queries/uploads'
import type { MediaType, ModerationStatus } from '@/lib/db/types'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { createDownloadPresignedUrl } from '@/lib/storage'
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/uploads/format'
import { ModerationQueue, type QueueItem } from './ModerationQueue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; type?: string }>
}

const STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected']

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
      timeLabel: formatRelativeTime(u.createdAt),
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

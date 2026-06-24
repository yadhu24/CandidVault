import { listUploadsForModeration, type ModerationUpload } from '@/lib/db/queries/uploads'
import type { MediaType, ModerationStatus } from '@/lib/db/types'
import { createDownloadPresignedUrl } from '@/lib/storage'
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/uploads/format'
import type { ModerationPage, QueueItem } from './types'

export const MODERATION_PAGE_SIZE = 48

// Presign thumbnails server-side; the storage key never reaches the client.
async function toQueueItem(u: ModerationUpload): Promise<QueueItem> {
  return {
    id: u.id,
    mediaType: u.mediaType,
    status: u.moderationStatus,
    sizeLabel: formatBytes(u.fileSizeBytes),
    timeLabel: formatRelativeTime(u.createdAt),
    uploaderName: u.uploaderName,
    durationLabel: u.durationSeconds ? formatDuration(u.durationSeconds) : undefined,
    thumbUrl: u.thumbnailKey ? await createDownloadPresignedUrl(u.thumbnailKey) : null,
  }
}

// One page of the moderation queue. Fetches one extra row to know if there's more
// without a second COUNT. Shared by the page (offset 0) and the load-more API.
export async function loadModerationPage(
  eventId: string,
  opts: { moderationStatus: ModerationStatus; mediaType?: MediaType; offset: number },
): Promise<ModerationPage> {
  const rows = await listUploadsForModeration(eventId, {
    moderationStatus: opts.moderationStatus,
    mediaType: opts.mediaType,
    limit: MODERATION_PAGE_SIZE + 1,
    offset: opts.offset,
  })
  const hasMore = rows.length > MODERATION_PAGE_SIZE
  const pageRows = hasMore ? rows.slice(0, MODERATION_PAGE_SIZE) : rows
  const items = await Promise.all(pageRows.map(toQueueItem))
  return { items, nextOffset: hasMore ? opts.offset + MODERATION_PAGE_SIZE : null }
}

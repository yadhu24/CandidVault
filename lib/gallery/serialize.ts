import { listApprovedUploads, type GalleryUpload } from '@/lib/db/queries/uploads'
import type { MediaType } from '@/lib/db/types'
import { createDownloadPresignedUrl } from '@/lib/storage'
import { formatBytes, formatDuration, formatRelativeTime } from '@/lib/uploads/format'
import type { GalleryItem, GalleryPage, GallerySort } from './types'

export const GALLERY_PAGE_SIZE = 24

const presignOrNull = (key: string | null | undefined): Promise<string | null> =>
  key ? createDownloadPresignedUrl(key) : Promise.resolve(null)

// Grid uses the thumbnail; modal uses the preview (poster for video). Both fall
// back through available variants so an item still renders if one is missing.
// Shared by the gallery feed and album views.
export async function toGalleryItem(u: GalleryUpload): Promise<GalleryItem> {
  const [thumbUrl, previewUrl] = await Promise.all([
    presignOrNull(u.thumbnailKey ?? u.previewKey),
    presignOrNull(u.previewKey ?? u.webKey ?? u.thumbnailKey),
  ])
  return {
    id: u.id,
    mediaType: u.mediaType,
    width: u.width,
    height: u.height,
    durationLabel: u.durationSeconds ? formatDuration(u.durationSeconds) : undefined,
    sizeLabel: formatBytes(u.fileSizeBytes),
    uploaderName: u.uploaderName,
    timeLabel: formatRelativeTime(u.createdAt),
    isFavorite: u.isFavorite,
    thumbUrl,
    previewUrl,
  }
}

// One page of approved media. Fetches one extra row to know if there's more
// without a second COUNT query. Shared by the gallery page (offset 0) and the
// load-more API.
export async function loadGalleryPage(
  eventId: string,
  opts: { mediaType?: MediaType; sort: GallerySort; offset: number; favoritesOnly?: boolean },
): Promise<GalleryPage> {
  const rows = await listApprovedUploads(eventId, {
    mediaType: opts.mediaType,
    sort: opts.sort,
    favoritesOnly: opts.favoritesOnly,
    limit: GALLERY_PAGE_SIZE + 1,
    offset: opts.offset,
  })
  const hasMore = rows.length > GALLERY_PAGE_SIZE
  const pageRows = hasMore ? rows.slice(0, GALLERY_PAGE_SIZE) : rows
  const items = await Promise.all(pageRows.map(toGalleryItem))
  return { items, nextOffset: hasMore ? opts.offset + GALLERY_PAGE_SIZE : null }
}

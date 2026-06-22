export type GallerySort = 'newest' | 'oldest'
export type GalleryTypeFilter = 'all' | 'photo' | 'video'

// Safe, client-facing shape of an approved upload. No storage keys — only
// short-lived presigned URLs for the thumbnail (grid) and preview (modal).
export interface GalleryItem {
  id: string
  mediaType: 'photo' | 'video'
  width: number | null
  height: number | null
  durationLabel?: string
  sizeLabel: string
  uploaderName: string | null
  timeLabel: string
  thumbUrl: string | null
  previewUrl: string | null
}

export interface GalleryPage {
  items: GalleryItem[]
  nextOffset: number | null
}

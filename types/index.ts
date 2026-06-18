export type EventStatus = 'draft' | 'active' | 'closed'
export type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type MediaType = 'photo' | 'video'

export interface Event {
  id: string
  slug: string
  name: string
  description: string | null
  photographerId: string
  status: EventStatus
  coverImageKey: string | null
  createdAt: string
  updatedAt: string
}

export interface MediaAsset {
  id: string
  eventId: string
  uploaderName: string | null
  storageKey: string
  thumbnailKey: string | null
  mediaType: MediaType
  mimeType: string
  fileSizeBytes: number
  status: MediaStatus
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

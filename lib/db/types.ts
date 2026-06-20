// Domain row types — one interface per table, camelCase to match the mapping in
// ./query. These mirror migrations/0001_init.sql; keep them in sync when the
// schema changes. Timestamps are ISO strings, bigints are numbers (see client.ts).

export type UserRole = 'photographer' | 'admin'
export type EventStatus = 'draft' | 'active' | 'closed'
export type EventType = 'wedding' | 'engagement' | 'birthday' | 'corporate' | 'party' | 'other'
export type MediaType = 'photo' | 'video'
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'
export type ModerationStatus = 'pending' | 'approved' | 'rejected'
export type ModerationAction = 'approve' | 'reject' | 'restore' | 'delete'
export type UploadVariantKind = 'thumbnail' | 'preview' | 'web'
export type ExportScope = 'all' | 'approved' | 'album'

export interface User {
  id: string
  email: string
  role: UserRole
  displayName: string | null
  createdAt: string
  updatedAt: string
}

export interface PhotographerProfile {
  id: string
  userId: string
  businessName: string | null
  contactEmail: string | null
  contactPhone: string | null
  websiteUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  photographerId: string
  slug: string
  name: string
  description: string | null
  eventType: EventType
  status: EventStatus
  eventDate: string | null
  venue: string | null
  coverUploadId: string | null
  createdAt: string
  updatedAt: string
}

export interface EventQrCode {
  id: string
  eventId: string
  token: string
  label: string | null
  isActive: boolean
  scanCount: number
  createdAt: string
  updatedAt: string
}

export interface GuestSession {
  id: string
  eventId: string
  qrCodeId: string | null
  displayName: string | null
  token: string
  createdAt: string
  lastSeenAt: string
}

export interface Upload {
  id: string
  eventId: string
  guestSessionId: string | null
  uploaderName: string | null
  mediaType: MediaType
  status: ProcessingStatus
  moderationStatus: ModerationStatus
  storageKey: string
  originalFilename: string | null
  mimeType: string
  fileSizeBytes: number
  checksum: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  capturedAt: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface UploadVariant {
  id: string
  uploadId: string
  variant: UploadVariantKind
  storageKey: string
  mimeType: string
  width: number | null
  height: number | null
  fileSizeBytes: number | null
  createdAt: string
}

export interface Album {
  id: string
  eventId: string
  name: string
  description: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface AlbumItem {
  id: string
  albumId: string
  uploadId: string
  position: number
  createdAt: string
}

export interface ModerationActionRecord {
  id: string
  uploadId: string
  actorId: string | null
  action: ModerationAction
  reason: string | null
  createdAt: string
}

export interface Export {
  id: string
  eventId: string
  requestedBy: string | null
  status: ProcessingStatus
  scope: ExportScope
  albumId: string | null
  storageKey: string | null
  fileSizeBytes: number | null
  itemCount: number | null
  errorDetail: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

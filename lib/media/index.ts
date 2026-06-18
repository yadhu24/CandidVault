// Shared stubs for thumbnail generation and metadata extraction.
// Implemented in full in the worker; these types/helpers are shared.

export interface MediaMetadata {
  width?: number
  height?: number
  durationSeconds?: number
  takenAt?: string
  cameraMake?: string
  cameraModel?: string
}

export function buildStorageKey(eventId: string, filename: string): string {
  return `events/${eventId}/original/${filename}`
}

export function buildThumbnailKey(eventId: string, assetId: string): string {
  return `events/${eventId}/thumbnails/${assetId}.webp`
}

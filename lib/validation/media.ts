import { z } from 'zod'
import type { MediaType } from '@/types'

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

// Per-media-type ceilings — images are capped tighter than video. MAX_FILE_SIZE_BYTES
// is the overall upper bound used for a coarse first check before the per-type one.
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024 // 30 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024 // 500 MB
export const MAX_FILE_SIZE_BYTES = MAX_VIDEO_BYTES

const MIME_TO_MEDIA_TYPE: Record<AllowedMimeType, MediaType> = {
  'image/jpeg': 'photo',
  'image/png': 'photo',
  'image/heic': 'photo',
  'image/webp': 'photo',
  'video/mp4': 'video',
  'video/quicktime': 'video',
}

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value)
}

export function mediaTypeForMime(mime: AllowedMimeType): MediaType {
  return MIME_TO_MEDIA_TYPE[mime]
}

export function extForMime(mime: AllowedMimeType): string {
  return MIME_TO_EXT[mime]
}

export function maxBytesForMime(mime: AllowedMimeType): number {
  return mediaTypeForMime(mime) === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
}

// Browser's request for a presigned upload URL. The declared size is checked
// against the per-type limit here and re-checked against the real object at confirm.
export const CreateUploadSessionSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  uploaderName: z.string().trim().max(100).optional().or(z.literal('')),
})

export type CreateUploadSessionInput = z.infer<typeof CreateUploadSessionSchema>

export const ConfirmUploadSchema = z.object({
  ticket: z.string().min(1).max(4096),
})

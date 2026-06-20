import { z } from 'zod'

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const

export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB

export const RequestUploadSchema = z.object({
  eventId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_MIME_TYPES),
  fileSizeBytes: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  uploaderName: z.string().max(100).optional(),
})

export type RequestUploadInput = z.infer<typeof RequestUploadSchema>

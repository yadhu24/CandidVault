import { describe, expect, it } from 'vitest'
import {
  ConfirmUploadSchema,
  CreateUploadSessionSchema,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PresignPartsSchema,
  isAllowedMimeType,
  maxBytesForMime,
  mediaTypeForMime,
} from '@/lib/validation/media'

describe('mime helpers', () => {
  it('recognizes allowed types', () => {
    expect(isAllowedMimeType('image/jpeg')).toBe(true)
    expect(isAllowedMimeType('video/mp4')).toBe(true)
  })

  it('rejects disallowed types', () => {
    expect(isAllowedMimeType('image/gif')).toBe(false)
    expect(isAllowedMimeType('application/pdf')).toBe(false)
  })

  it('maps mime to media type', () => {
    expect(mediaTypeForMime('image/png')).toBe('photo')
    expect(mediaTypeForMime('video/quicktime')).toBe('video')
  })

  it('caps images tighter than video', () => {
    expect(maxBytesForMime('image/jpeg')).toBe(MAX_IMAGE_BYTES)
    expect(maxBytesForMime('video/mp4')).toBe(MAX_VIDEO_BYTES)
    expect(MAX_IMAGE_BYTES).toBeLessThan(MAX_VIDEO_BYTES)
  })
})

describe('CreateUploadSessionSchema', () => {
  const valid = {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
    fileSizeBytes: 1_000_000,
    uploaderName: 'Sam',
  }

  it('accepts a valid request', () => {
    expect(CreateUploadSessionSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a disallowed content type', () => {
    expect(CreateUploadSessionSchema.safeParse({ ...valid, contentType: 'image/gif' }).success).toBe(
      false,
    )
  })

  it('rejects non-positive or non-integer sizes', () => {
    expect(CreateUploadSessionSchema.safeParse({ ...valid, fileSizeBytes: 0 }).success).toBe(false)
    expect(CreateUploadSessionSchema.safeParse({ ...valid, fileSizeBytes: -5 }).success).toBe(false)
    expect(CreateUploadSessionSchema.safeParse({ ...valid, fileSizeBytes: 1.5 }).success).toBe(false)
  })

  it('rejects sizes over the hard ceiling', () => {
    expect(
      CreateUploadSessionSchema.safeParse({ ...valid, fileSizeBytes: MAX_FILE_SIZE_BYTES + 1 })
        .success,
    ).toBe(false)
  })

  it('requires a filename within bounds', () => {
    expect(CreateUploadSessionSchema.safeParse({ ...valid, filename: '' }).success).toBe(false)
    expect(CreateUploadSessionSchema.safeParse({ ...valid, filename: 'x'.repeat(256) }).success).toBe(
      false,
    )
  })

  it('treats uploaderName as optional', () => {
    const rest = {
      filename: valid.filename,
      contentType: valid.contentType,
      fileSizeBytes: valid.fileSizeBytes,
    }
    expect(CreateUploadSessionSchema.safeParse(rest).success).toBe(true)
  })
})

describe('PresignPartsSchema', () => {
  it('accepts valid part numbers', () => {
    expect(PresignPartsSchema.safeParse({ ticket: 't', partNumbers: [1, 2, 3] }).success).toBe(true)
  })

  it('rejects an empty part list', () => {
    expect(PresignPartsSchema.safeParse({ ticket: 't', partNumbers: [] }).success).toBe(false)
  })

  it('rejects out-of-range part numbers', () => {
    expect(PresignPartsSchema.safeParse({ ticket: 't', partNumbers: [0] }).success).toBe(false)
    expect(PresignPartsSchema.safeParse({ ticket: 't', partNumbers: [10_001] }).success).toBe(false)
  })
})

describe('ConfirmUploadSchema', () => {
  it('accepts a single-PUT confirm (ticket only)', () => {
    expect(ConfirmUploadSchema.safeParse({ ticket: 't' }).success).toBe(true)
  })

  it('accepts a multipart confirm with parts', () => {
    const parts = [{ partNumber: 1, etag: 'abc' }]
    expect(ConfirmUploadSchema.safeParse({ ticket: 't', parts }).success).toBe(true)
  })

  it('bounds the parts array', () => {
    const parts = Array.from({ length: 1001 }, (_, i) => ({ partNumber: i + 1, etag: 'e' }))
    expect(ConfirmUploadSchema.safeParse({ ticket: 't', parts }).success).toBe(false)
  })
})

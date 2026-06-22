import type { UploadVariantKind } from '@/lib/db/types'

export interface ImageDimensions {
  width: number | null
  height: number | null
}

export interface VariantSpec {
  variant: UploadVariantKind
  // Longest edge in px; aspect ratio is preserved and images are never upscaled.
  maxEdge: number
  // webp for thumbnails/previews (tiny, universal); jpeg for the full-size HEIC
  // fallback so the rendition opens in any browser and in ZIP exports.
  format: 'webp' | 'jpeg'
}

export interface VideoProbe {
  durationSeconds: number | null
  width: number | null
  height: number | null
}

export interface RenderedVariant {
  variant: UploadVariantKind
  buffer: Buffer
  contentType: string
  ext: string
  width: number
  height: number
  bytes: number
}

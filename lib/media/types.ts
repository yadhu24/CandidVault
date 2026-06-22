import type { UploadVariantKind } from '@/lib/db/types'

export interface ImageDimensions {
  width: number | null
  height: number | null
}

export interface VariantSpec {
  variant: UploadVariantKind
  // Longest edge in px; aspect ratio is preserved and images are never upscaled.
  maxEdge: number
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

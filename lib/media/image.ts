import type { ImageDimensions, RenderedVariant, VariantSpec } from './types'

// sharp is a native module. We load it lazily (dynamic import) so it never lands
// in the Next.js bundle and so the worker degrades to "metadata only" rather
// than crashing on a host where the native binary is unavailable.
type SharpFactory = (typeof import('sharp'))['default']
let cached: SharpFactory | null | undefined

async function loadSharp(): Promise<SharpFactory | null> {
  if (cached !== undefined) return cached
  try {
    cached = (await import('sharp')).default
  } catch {
    cached = null
  }
  return cached
}

export async function imageProcessingAvailable(): Promise<boolean> {
  return (await loadSharp()) !== null
}

// Variants generated for every image. webp keeps thumbnails tiny while staying
// widely supported by modern phones and browsers.
export const IMAGE_VARIANTS: VariantSpec[] = [
  { variant: 'thumbnail', maxEdge: 480 },
  { variant: 'preview', maxEdge: 1280 },
]

// Original (display) dimensions, accounting for EXIF orientation so portrait
// photos aren't reported as landscape.
export async function readImageDimensions(input: Buffer): Promise<ImageDimensions> {
  const sharp = await loadSharp()
  if (!sharp) return { width: null, height: null }
  const meta = await sharp(input).metadata()
  const width = meta.width ?? null
  const height = meta.height ?? null
  const rotated = meta.orientation !== undefined && meta.orientation >= 5
  return rotated ? { width: height, height: width } : { width, height }
}

// Render one resized webp variant. Returns null when sharp is unavailable so the
// caller can skip variant generation without failing the whole job.
export async function renderImageVariant(
  input: Buffer,
  spec: VariantSpec,
): Promise<RenderedVariant | null> {
  const sharp = await loadSharp()
  if (!sharp) return null
  const { data, info } = await sharp(input)
    .rotate() // bake EXIF orientation into the pixels
    .resize(spec.maxEdge, spec.maxEdge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: spec.variant === 'thumbnail' ? 72 : 82 })
    .toBuffer({ resolveWithObject: true })
  return {
    variant: spec.variant,
    buffer: data,
    contentType: 'image/webp',
    ext: 'webp',
    width: info.width,
    height: info.height,
    bytes: info.size,
  }
}

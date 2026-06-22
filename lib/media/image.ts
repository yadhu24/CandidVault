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

const HEIC_MIMES = new Set(['image/heic', 'image/heif'])

// Variant plan for an image. Thumbnails/previews are webp (tiny, universal).
// HEIC originals don't render in most browsers, so HEIC additionally gets a
// full-size JPEG ('web') for full view, download, and ZIP export — this is the
// required HEIC -> JPEG transcode.
export function variantsForImage(mime: string): VariantSpec[] {
  const specs: VariantSpec[] = [
    { variant: 'thumbnail', maxEdge: 480, format: 'webp' },
    { variant: 'preview', maxEdge: 1280, format: 'webp' },
  ]
  if (HEIC_MIMES.has(mime)) specs.push({ variant: 'web', maxEdge: 2560, format: 'jpeg' })
  return specs
}

export function isHeicMime(mime: string): boolean {
  return HEIC_MIMES.has(mime)
}

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

// Render one resized variant (webp or jpeg per spec). Decodes HEIC transparently
// via libvips. Returns null when sharp is unavailable so the caller can skip
// variant generation without failing the whole job.
export async function renderImageVariant(
  input: Buffer,
  spec: VariantSpec,
): Promise<RenderedVariant | null> {
  const sharp = await loadSharp()
  if (!sharp) return null
  const resized = sharp(input)
    .rotate() // bake EXIF orientation into the pixels
    .resize(spec.maxEdge, spec.maxEdge, { fit: 'inside', withoutEnlargement: true })
  const isJpeg = spec.format === 'jpeg'
  const encoded = isJpeg
    ? resized.jpeg({ quality: 85, mozjpeg: true })
    : resized.webp({ quality: spec.variant === 'thumbnail' ? 72 : 82 })
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
  return {
    variant: spec.variant,
    buffer: data,
    contentType: isJpeg ? 'image/jpeg' : 'image/webp',
    ext: isJpeg ? 'jpg' : 'webp',
    width: info.width,
    height: info.height,
    bytes: info.size,
  }
}

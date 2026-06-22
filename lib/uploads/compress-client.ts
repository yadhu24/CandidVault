// Browser-only image compression to cut upload payload on poor mobile networks.
// Resizes large photos and re-encodes to JPEG. HEIC/HEIF are left untouched —
// browsers can't reliably decode them; the server transcodes HEIC instead. Any
// failure (or no size win) returns the original file unchanged.
const MAX_EDGE = 2560
const QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === 'image/heic' || file.type === 'image/heif') return file
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    // White matte so PNGs with transparency don't flatten to black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  }
}

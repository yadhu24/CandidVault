// Sanitizes a guest-supplied filename for safe storage as display metadata only
// (it never appears in an object key). Strips control chars and path separators.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F]', 'g')

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(CONTROL_CHARS, '').replace(/[\\/]/g, '_').trim()
  return cleaned.slice(0, 200) || 'upload'
}

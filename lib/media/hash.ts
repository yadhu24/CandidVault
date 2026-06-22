import { createHash } from 'node:crypto'

// SHA-256 hex digest of the original bytes — integrity + dedupe signal stored on
// the upload row. Cheap once the bytes are already in memory for processing.
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

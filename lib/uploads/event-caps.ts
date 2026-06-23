import { getEventUploadUsage } from '@/lib/db/queries/uploads'

// Per-event hard ceilings — an abuse brake so a single event (or a flood of
// spoofed guest sessions) can't accumulate unbounded rows or storage even if the
// IP rate limiter is evaded. Generous enough for large real events; tune per
// deploy via env. Enforced at presign (fast fail, declared size) and re-checked
// against the REAL object bytes at confirm (authoritative).
//
// Server-only: kept out of lib/validation/media.ts because that module is also
// imported by the client uploader, and these read server env.
const DEFAULT_MAX_UPLOADS = 10_000
const DEFAULT_MAX_GB = 100

function positiveIntEnv(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export const MAX_UPLOADS_PER_EVENT = positiveIntEnv('UPLOAD_MAX_PER_EVENT', DEFAULT_MAX_UPLOADS)
export const MAX_EVENT_TOTAL_BYTES =
  positiveIntEnv('UPLOAD_MAX_BYTES_PER_EVENT_GB', DEFAULT_MAX_GB) * 1024 ** 3

export type CapResult = { ok: true } | { ok: false; reason: 'count' | 'bytes' }

// Pure decision so it is trivially unit-testable without a DB.
export function evaluateUploadCap(
  usage: { count: number; totalBytes: number },
  addBytes: number,
): CapResult {
  if (usage.count >= MAX_UPLOADS_PER_EVENT) return { ok: false, reason: 'count' }
  if (usage.totalBytes + Math.max(0, addBytes) > MAX_EVENT_TOTAL_BYTES) {
    return { ok: false, reason: 'bytes' }
  }
  return { ok: true }
}

// Fetches current usage and evaluates the cap for an incoming file of `addBytes`.
// NOTE: count + check is not a single transaction, so under heavy concurrency the
// cap can be exceeded by a small margin; that's an accepted MVP tradeoff (see
// docs/security.md). It still hard-bounds sustained abuse.
export async function eventUploadCapStatus(eventId: string, addBytes: number): Promise<CapResult> {
  const usage = await getEventUploadUsage(eventId)
  return evaluateUploadCap(usage, addBytes)
}

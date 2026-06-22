// Best-effort, in-memory fixed-window rate limiter.
//
// IMPORTANT: this is per-process only. In a multi-instance / serverless deploy it
// does NOT enforce a global limit and must be backed by a shared store (Redis,
// Upstash, Cloudflare KV/Durable Objects) before it can be relied on. It exists
// here as a basic abuse brake on the public, unauthenticated upload endpoints.
interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  // Opportunistic cleanup so the map can't grow without bound.
  if (windows.size > 5000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
  }

  const existing = windows.get(key)
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

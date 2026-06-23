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

// Deriving a client IP is only as trustworthy as the proxy in front of us. A
// client can freely set X-Forwarded-For, so its LEFTMOST value is attacker-
// controlled and must not key a rate limiter (spoofing it = a fresh bucket per
// request). We prefer a single-value header that the deployment's trusted edge
// sets/overwrites:
//   * Vercel & many proxies: x-real-ip
//   * Cloudflare:            cf-connecting-ip
// Set TRUSTED_IP_HEADER if your edge uses a different one. Without a trusted
// proxy guaranteeing the header, IP-based limiting is best-effort only.
export function clientIp(request: Request): string {
  const configured = process.env.TRUSTED_IP_HEADER
  if (configured) {
    const v = request.headers.get(configured)
    if (v) return v.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()
  // Last resort only: spoofable, but keeps limiting functional in dev/local where
  // no trusted proxy header exists.
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

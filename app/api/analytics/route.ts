import { z } from 'zod'
import { apiError } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { getAuthUser } from '@/lib/auth/guards'
import { CLIENT_ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'

// Browser-reported product events (link_copied, upload_started). Server-derived
// events are NOT accepted here — they're fired from route handlers/actions/worker
// so they can't be spoofed. Best-effort: always 204, never blocks the client.
const BodySchema = z.object({
  name: z.enum(CLIENT_ANALYTICS_EVENTS),
  eventId: z.string().uuid().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
})

const noContent = () => new Response(null, { status: 204 })

export async function POST(request: Request) {
  if (!rateLimit(`analytics:${clientIp(request)}`, 120, 60_000)) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.')
  }

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  // Silently drop malformed beacons — clients ignore the response anyway, and we
  // never want analytics noise to look like a client error.
  if (!parsed.success) return noContent()

  // Identity from the session (never the body). Authenticated => photographer.
  const user = await getAuthUser()

  // Bound stored context so a client can't write large/abusive payloads.
  let properties = parsed.data.properties ?? {}
  if (JSON.stringify(properties).length > 2000) properties = {}

  await track(parsed.data.name, {
    eventId: parsed.data.eventId ?? null,
    actorId: user?.id ?? null,
    actorType: user ? 'photographer' : 'guest',
    properties,
  })

  return noContent()
}

import type { ClientAnalyticsEventName } from './events'

interface ClientTrackPayload {
  name: ClientAnalyticsEventName
  eventId?: string
  properties?: Record<string, unknown>
}

// Reports a browser-side product event to POST /api/analytics. Best-effort and
// non-blocking: uses sendBeacon when available (survives navigation/unload), and
// never throws — analytics must not interfere with the user's action.
export function trackClient(
  name: ClientAnalyticsEventName,
  opts: { eventId?: string; properties?: Record<string, unknown> } = {},
): void {
  if (typeof window === 'undefined') return
  const payload: ClientTrackPayload = { name, eventId: opts.eventId, properties: opts.properties }
  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // best-effort only
  }
}

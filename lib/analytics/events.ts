// Single source of truth for the product analytics taxonomy. The DB column is
// plain text (see migration 0006); this union is what the app validates against,
// so adding/removing an event is a code change, not a migration.
export const ANALYTICS_EVENTS = [
  'event_created',
  'qr_downloaded',
  'link_copied',
  'public_page_opened',
  'upload_started',
  'upload_completed',
  'upload_failed',
  'upload_approved',
  'upload_rejected',
  'export_requested',
  'export_completed',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

// The subset a browser is allowed to report via POST /api/analytics. Everything
// else is server-authoritative (fired from route handlers / actions / worker) so
// it can't be spoofed or inflated by clients.
export const CLIENT_ANALYTICS_EVENTS = ['link_copied', 'upload_started'] as const
export type ClientAnalyticsEventName = (typeof CLIENT_ANALYTICS_EVENTS)[number]

export function isClientAnalyticsEvent(value: unknown): value is ClientAnalyticsEventName {
  return typeof value === 'string' && (CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(value)
}

// Single source of truth for the app's public base URL. Anything that needs an
// absolute URL — QR code targets, guest share links, OG/canonical metadata —
// derives from here so there is exactly one place to change the origin.
//
// NEXT_PUBLIC_APP_URL is the override: set it to http://localhost:3000 in dev and
// to the production origin in the host. When it is unset we fall back to the
// canonical production domain so a missing env var degrades to the correct host
// instead of emitting broken relative links (e.g. an unscannable QR code).
export const PRODUCTION_APP_URL = 'https://candidvault.org'

export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  return (configured || PRODUCTION_APP_URL).replace(/\/+$/, '')
}

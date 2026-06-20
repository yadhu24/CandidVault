// The public guest-upload URL is derived from the event slug — already unique
// per event, so it is the event's unique upload URL. NEXT_PUBLIC_APP_URL must be
// set for the QR to encode an absolute, scannable link.
export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
}

export function eventUploadPath(slug: string): string {
  return `/e/${slug}`
}

export function eventUploadUrl(slug: string): string {
  return `${appBaseUrl()}${eventUploadPath(slug)}`
}

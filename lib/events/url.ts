// The public guest-upload URL is derived from the event slug — already unique
// per event, so it is the event's unique upload URL. The absolute form is built
// from the app's single base-URL source (see lib/app-url) so the QR encodes a
// scannable link to the production domain.
import { appBaseUrl } from '@/lib/app-url'

export function eventUploadPath(slug: string): string {
  return `/e/${slug}`
}

export function eventUploadUrl(slug: string): string {
  return `${appBaseUrl()}${eventUploadPath(slug)}`
}

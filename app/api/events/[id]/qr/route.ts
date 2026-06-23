import { after } from 'next/server'
import { requirePhotographer } from '@/lib/account/photographers'
import { track } from '@/lib/analytics/track'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { eventUploadUrl } from '@/lib/events/url'
import { qrPngBuffer } from '@/lib/qr'

// GET /api/events/[id]/qr — returns the event's QR as a downloadable PNG.
// Ownership is enforced (the QR encodes a public URL, but the endpoint is the
// owner's). The slug is [a-z0-9-], safe to use directly in the filename.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id)

  const png = await qrPngBuffer(eventUploadUrl(event.slug))

  after(() =>
    track('qr_downloaded', { eventId: event.id, actorId: user.id, actorType: 'photographer' }),
  )

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${event.slug}-qr.png"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}

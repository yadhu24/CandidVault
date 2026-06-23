import { apiError, apiJson } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { resolvePublicEvent } from '@/lib/events/service'
import { PresignPartsSchema } from '@/lib/validation/media'
import { presignUploadPart } from '@/lib/storage'
import { isKeyForEvent } from '@/lib/storage/keys'
import { verifyUploadTicket } from '@/lib/uploads/ticket'

interface Params {
  params: Promise<{ slug: string }>
}

// POST /api/e/[slug]/upload-parts
// Returns presigned PUT URLs for the requested part numbers of a multipart
// upload. The signed ticket carries the key + R2 upload id, so the browser names
// only part NUMBERS — never the key or upload id. Requesting just the parts it
// still needs is what makes a dropped connection resumable.
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params

  if (!rateLimit(`parts:${clientIp(request)}`, 120, 60_000)) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.')
  }

  const body = await request.json().catch(() => null)
  const parsed = PresignPartsSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(422, 'INVALID_PARTS_REQUEST', 'The request was invalid.')
  }

  const ticket = verifyUploadTicket(parsed.data.ticket)
  if (!ticket || !ticket.multipart) {
    return apiError(400, 'INVALID_TICKET', 'This upload ticket is invalid or has expired.')
  }

  try {
    const resolution = await resolvePublicEvent(slug)
    if (resolution.state !== 'ok' || resolution.event.id !== ticket.eventId) {
      return apiError(403, 'EVENT_NOT_ACCEPTING_UPLOADS', 'This event is not accepting uploads.')
    }
    if (!isKeyForEvent(ticket.key, resolution.event.id)) {
      return apiError(400, 'INVALID_TICKET', 'This upload ticket is invalid or has expired.')
    }

    const urls: Record<number, string> = {}
    for (const partNumber of parsed.data.partNumbers) {
      urls[partNumber] = await presignUploadPart(ticket.key, ticket.multipart.uploadId, partNumber)
    }
    return apiJson({ urls }, 201)
  } catch (err) {
    console.error('[upload-parts] unexpected error', { name: (err as { name?: string })?.name })
    return apiError(500, 'INTERNAL_ERROR', 'Could not prepare the upload. Please try again.')
  }
}

import { apiError, apiJson } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { resolvePublicEvent } from '@/lib/events/service'
import { registerUpload } from '@/lib/db/queries/uploads'
import { ConfirmUploadSchema } from '@/lib/validation/media'
import { deleteObject, headObject } from '@/lib/storage'
import { verifyUploadTicket } from '@/lib/uploads/ticket'

interface Params {
  params: Promise<{ slug: string }>
}

async function safeDelete(key: string) {
  try {
    await deleteObject(key)
  } catch (err) {
    // Best-effort cleanup; a leftover unregistered object is swept by lifecycle.
    console.error('[uploads.confirm] failed to delete rejected object', {
      code: (err as { name?: string })?.name,
    })
  }
}

// POST /api/e/[slug]/uploads
// Confirms a completed direct-to-R2 upload: verifies the signed ticket, re-checks
// the event, verifies the real object against the limits (deleting it if it
// violates them), then records the upload in pending moderation state.
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params

  if (!rateLimit(`confirm:${clientIp(request)}`, 60, 60_000)) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.')
  }

  const body = await request.json().catch(() => null)
  const parsed = ConfirmUploadSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(422, 'INVALID_CONFIRM_REQUEST', 'The confirmation request was invalid.')
  }

  const ticket = verifyUploadTicket(parsed.data.ticket)
  if (!ticket) {
    return apiError(400, 'INVALID_TICKET', 'This upload ticket is invalid or has expired.')
  }

  try {
    // The event must still be active and must match the ticket's event.
    const resolution = await resolvePublicEvent(slug)
    if (resolution.state !== 'ok' || resolution.event.id !== ticket.eventId) {
      await safeDelete(ticket.key)
      return apiError(403, 'EVENT_NOT_ACCEPTING_UPLOADS', 'This event is not accepting uploads.')
    }

    // Prove the object was actually uploaded, and re-validate the REAL bytes — the
    // browser can't be trusted on size/type even though the URL pinned the type.
    const head = await headObject(ticket.key)
    if (!head) {
      return apiError(409, 'UPLOAD_NOT_FOUND', 'No uploaded file was found for this ticket.')
    }
    if (head.contentLength > ticket.maxBytes || head.contentType !== ticket.contentType) {
      await safeDelete(ticket.key)
      return apiError(422, 'UPLOAD_REJECTED', 'The uploaded file failed validation.')
    }

    const upload = await registerUpload({
      eventId: ticket.eventId,
      storageKey: ticket.key,
      mediaType: ticket.mediaType,
      mimeType: ticket.contentType,
      fileSizeBytes: head.contentLength,
      guestSessionId: ticket.guestSessionId,
      uploaderName: ticket.uploaderName,
      originalFilename: ticket.filename,
    })

    // Only non-sensitive fields — never the storage key or any signed URL.
    return apiJson(
      {
        upload: {
          id: upload.id,
          status: upload.status,
          moderationStatus: upload.moderationStatus,
          mediaType: upload.mediaType,
          originalFilename: upload.originalFilename,
          createdAt: upload.createdAt,
        },
      },
      201,
    )
  } catch (err) {
    console.error('[uploads.confirm] unexpected error', { name: (err as { name?: string })?.name })
    return apiError(500, 'INTERNAL_ERROR', 'Could not finalize the upload. Please try again.')
  }
}

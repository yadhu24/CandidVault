import { apiError, apiJson } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { resolvePublicEvent } from '@/lib/events/service'
import { registerUpload } from '@/lib/db/queries/uploads'
import { ConfirmUploadSchema } from '@/lib/validation/media'
import { abortMultipartUpload, completeMultipartUpload, deleteObject, headObject } from '@/lib/storage'
import { verifyUploadTicket, type UploadTicketPayload } from '@/lib/uploads/ticket'

interface Params {
  params: Promise<{ slug: string }>
}

async function safeDelete(key: string) {
  try {
    await deleteObject(key)
  } catch (err) {
    console.error('[uploads.confirm] failed to delete rejected object', {
      code: (err as { name?: string })?.name,
    })
  }
}

// Releases an upload we won't register: a completed object is deleted, an
// in-progress multipart upload is aborted (no object exists yet).
async function cleanupAbandoned(ticket: UploadTicketPayload) {
  if (ticket.multipart) {
    try {
      await abortMultipartUpload(ticket.key, ticket.multipart.uploadId)
    } catch (err) {
      console.error('[uploads.confirm] failed to abort multipart upload', {
        code: (err as { name?: string })?.name,
      })
    }
    return
  }
  await safeDelete(ticket.key)
}

// POST /api/e/[slug]/uploads
// Confirms a completed upload. For single PUTs: verify the object exists. For
// multipart: assemble the parts first. Either way, re-check the event, validate
// the REAL bytes against the limits (deleting on violation), then record the
// upload in pending moderation state.
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
      await cleanupAbandoned(ticket)
      return apiError(403, 'EVENT_NOT_ACCEPTING_UPLOADS', 'This event is not accepting uploads.')
    }

    // Multipart: assemble the parts into the final object before validating.
    if (ticket.multipart) {
      const parts = parsed.data.parts
      if (!parts || parts.length === 0) {
        await cleanupAbandoned(ticket)
        return apiError(422, 'INVALID_CONFIRM_REQUEST', 'Missing uploaded parts.')
      }
      try {
        await completeMultipartUpload(ticket.key, ticket.multipart.uploadId, parts)
      } catch (err) {
        console.error('[uploads.confirm] multipart completion failed', {
          name: (err as { name?: string })?.name,
        })
        await cleanupAbandoned(ticket)
        return apiError(422, 'UPLOAD_REJECTED', 'The upload could not be assembled. Please retry.')
      }
    }

    // Prove the object exists, and re-validate the REAL bytes — the browser can't
    // be trusted on size/type even though the URL pinned the type.
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

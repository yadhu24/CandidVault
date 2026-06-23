import { after } from 'next/server'
import { apiError, apiJson } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { resolvePublicEvent } from '@/lib/events/service'
import { getUploadByStorageKey, registerUpload } from '@/lib/db/queries/uploads'
import { track } from '@/lib/analytics/track'
import type { Upload } from '@/lib/db/types'
import { ConfirmUploadSchema } from '@/lib/validation/media'
import { abortMultipartUpload, completeMultipartUpload, deleteObject, headObject } from '@/lib/storage'
import { isKeyForEvent } from '@/lib/storage/keys'
import { eventUploadCapStatus } from '@/lib/uploads/event-caps'
import { verifyUploadTicket, type UploadTicketPayload } from '@/lib/uploads/ticket'

interface Params {
  params: Promise<{ slug: string }>
}

// Only ever expose non-sensitive fields — never the storage key or any signed URL.
function uploadResponse(upload: Upload) {
  return {
    upload: {
      id: upload.id,
      status: upload.status,
      moderationStatus: upload.moderationStatus,
      mediaType: upload.mediaType,
      originalFilename: upload.originalFilename,
      createdAt: upload.createdAt,
    },
  }
}

// Records an upload-pipeline failure with its reason (CLAUDE.md: log failure
// reasons where feasible). after() so it runs without delaying the response.
function trackFailed(eventId: string, reason: string) {
  after(() => track('upload_failed', { eventId, actorType: 'guest', properties: { reason } }))
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
      trackFailed(ticket.eventId, 'event_inactive')
      return apiError(403, 'EVENT_NOT_ACCEPTING_UPLOADS', 'This event is not accepting uploads.')
    }

    // Defense-in-depth: the signed ticket binds the key to its event, but assert
    // the key really lives under this event's prefix before acting on it.
    if (!isKeyForEvent(ticket.key, resolution.event.id)) {
      return apiError(400, 'INVALID_TICKET', 'This upload ticket is invalid or has expired.')
    }

    // Idempotent retry: if this object is already registered, return it without
    // re-completing the multipart upload or re-counting it against the cap.
    const existing = await getUploadByStorageKey(ticket.key)
    if (existing) {
      return apiJson(uploadResponse(existing), 201)
    }

    // Multipart: assemble the parts into the final object before validating.
    if (ticket.multipart) {
      const parts = parsed.data.parts
      if (!parts || parts.length === 0) {
        await cleanupAbandoned(ticket)
        trackFailed(ticket.eventId, 'missing_parts')
        return apiError(422, 'INVALID_CONFIRM_REQUEST', 'Missing uploaded parts.')
      }
      try {
        await completeMultipartUpload(ticket.key, ticket.multipart.uploadId, parts)
      } catch (err) {
        console.error('[uploads.confirm] multipart completion failed', {
          name: (err as { name?: string })?.name,
        })
        await cleanupAbandoned(ticket)
        trackFailed(ticket.eventId, 'multipart_assembly')
        return apiError(422, 'UPLOAD_REJECTED', 'The upload could not be assembled. Please retry.')
      }
    }

    // Prove the object exists, and re-validate the REAL bytes — the browser can't
    // be trusted on size/type even though the URL pinned the type.
    const head = await headObject(ticket.key)
    if (!head) {
      trackFailed(ticket.eventId, 'object_missing')
      return apiError(409, 'UPLOAD_NOT_FOUND', 'No uploaded file was found for this ticket.')
    }
    if (head.contentLength > ticket.maxBytes || head.contentType !== ticket.contentType) {
      await safeDelete(ticket.key)
      trackFailed(ticket.eventId, 'validation')
      return apiError(422, 'UPLOAD_REJECTED', 'The uploaded file failed validation.')
    }

    // Authoritative per-event cap re-check against the REAL bytes (the presign
    // check used the client-declared size). Reject + delete if it would exceed.
    const cap = await eventUploadCapStatus(ticket.eventId, head.contentLength)
    if (!cap.ok) {
      await safeDelete(ticket.key)
      trackFailed(ticket.eventId, `cap_${cap.reason}`)
      return apiError(
        409,
        'EVENT_UPLOAD_LIMIT',
        'This event has reached its upload limit. Please contact the host.',
      )
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

    after(() =>
      track('upload_completed', {
        eventId: ticket.eventId,
        actorType: 'guest',
        properties: {
          mediaType: ticket.mediaType,
          bytes: head.contentLength,
          mode: ticket.multipart ? 'multipart' : 'single',
        },
      }),
    )
    return apiJson(uploadResponse(upload), 201)
  } catch (err) {
    console.error('[uploads.confirm] unexpected error', { name: (err as { name?: string })?.name })
    trackFailed(ticket.eventId, 'internal')
    return apiError(500, 'INTERNAL_ERROR', 'Could not finalize the upload. Please try again.')
  }
}

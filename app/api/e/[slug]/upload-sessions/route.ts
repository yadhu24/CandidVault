import { apiError, apiJson } from '@/lib/http/responses'
import { clientIp, rateLimit } from '@/lib/http/rate-limit'
import { resolvePublicEvent } from '@/lib/events/service'
import {
  CreateUploadSessionSchema,
  MULTIPART_THRESHOLD_BYTES,
  UPLOAD_PART_SIZE_BYTES,
  maxBytesForMime,
  mediaTypeForMime,
} from '@/lib/validation/media'
import { buildOriginalObjectKey } from '@/lib/storage/keys'
import { createMultipartUpload, createUploadPresignedUrl } from '@/lib/storage'
import { getOrCreateGuestSession } from '@/lib/uploads/guest-session'
import { sanitizeFilename } from '@/lib/uploads/filename'
import { signUploadTicket } from '@/lib/uploads/ticket'

interface Params {
  params: Promise<{ slug: string }>
}

// POST /api/e/[slug]/upload-sessions
// Validates the event + requested file, ensures a guest session, and returns a
// short-lived presigned PUT URL plus a signed ticket to confirm with. No upload
// row is created yet (created at confirmation), and no object key is exposed
// except inside the write-only signed URL.
export async function POST(request: Request, { params }: Params) {
  const { slug } = await params

  if (!rateLimit(`presign:${clientIp(request)}`, 30, 60_000)) {
    return apiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.')
  }

  try {
    const resolution = await resolvePublicEvent(slug)
    if (resolution.state === 'not_found') {
      return apiError(404, 'EVENT_NOT_FOUND', 'This event could not be found.')
    }
    if (resolution.state !== 'ok') {
      return apiError(403, 'EVENT_NOT_ACCEPTING_UPLOADS', 'This event is not accepting uploads.')
    }
    const event = resolution.event

    const body = await request.json().catch(() => null)
    const parsed = CreateUploadSessionSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(422, 'INVALID_UPLOAD_REQUEST', 'The upload request was invalid.')
    }
    const { filename, contentType, fileSizeBytes, uploaderName } = parsed.data

    const maxBytes = maxBytesForMime(contentType)
    if (fileSizeBytes > maxBytes) {
      return apiError(422, 'FILE_TOO_LARGE', 'This file exceeds the size limit for its type.')
    }

    const mediaType = mediaTypeForMime(contentType)
    const cleanName = sanitizeFilename(filename)
    const cleanUploaderName = uploaderName ? uploaderName.trim() || null : null

    const session = await getOrCreateGuestSession(event.id, cleanUploaderName)
    const key = buildOriginalObjectKey(event.id, contentType)

    const base = {
      key,
      eventId: event.id,
      guestSessionId: session.id,
      mediaType,
      contentType,
      maxBytes,
      filename: cleanName,
      uploaderName: cleanUploaderName,
    }

    // Large files upload in resumable parts; small ones use a single PUT. Either
    // way the key lives only inside the signed ticket.
    if (fileSizeBytes > MULTIPART_THRESHOLD_BYTES) {
      const uploadId = await createMultipartUpload(key, contentType)
      const ticket = signUploadTicket({
        ...base,
        multipart: { uploadId, partSize: UPLOAD_PART_SIZE_BYTES },
      })
      return apiJson({ mode: 'multipart', partSize: UPLOAD_PART_SIZE_BYTES, ticket }, 201)
    }

    const uploadUrl = await createUploadPresignedUrl(key, contentType)
    const ticket = signUploadTicket(base)
    return apiJson({ mode: 'single', uploadUrl, ticket }, 201)
  } catch (err) {
    console.error('[upload-sessions] unexpected error', { name: (err as { name?: string })?.name })
    return apiError(500, 'INTERNAL_ERROR', 'Could not start the upload. Please try again.')
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AllowedMimeType } from '@/lib/validation/media'
import type { MediaType } from '@/types'

// A stateless, tamper-proof "permission to register this upload". Issued at
// presign time and verified at confirm time, so the browser cannot fabricate the
// object key, event, session, or limits it confirms against. Signed with a
// server-only secret; short-lived.
const TICKET_TTL_SECONDS = 30 * 60

export interface UploadTicketPayload {
  key: string
  eventId: string
  guestSessionId: string
  mediaType: MediaType
  contentType: AllowedMimeType
  maxBytes: number
  filename: string
  uploaderName: string | null
  // Present for multipart uploads only. Binds the server-issued R2 upload id (and
  // part size) into the signed ticket, so the browser can presign parts and
  // complete the upload without ever being trusted with the key or upload id.
  multipart?: { uploadId: string; partSize: number }
  exp: number
}

function getSecret(): string {
  const secret = process.env.UPLOAD_SIGNING_SECRET
  if (!secret) throw new Error('UPLOAD_SIGNING_SECRET is not set')
  return secret
}

function sign(body: string): string {
  return createHmac('sha256', getSecret()).update(body).digest('base64url')
}

export function signUploadTicket(payload: Omit<UploadTicketPayload, 'exp'>): string {
  const full: UploadTicketPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyUploadTicket(ticket: string): UploadTicketPayload | null {
  const dot = ticket.indexOf('.')
  if (dot <= 0) return null
  const body = ticket.slice(0, dot)
  const sig = ticket.slice(dot + 1)

  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: UploadTicketPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

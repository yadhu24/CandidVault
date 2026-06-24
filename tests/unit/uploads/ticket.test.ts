import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { signUploadTicket, verifyUploadTicket } from '@/lib/uploads/ticket'

const basePayload = {
  key: 'events/11111111-1111-1111-1111-111111111111/originals/abc.jpg',
  eventId: '11111111-1111-1111-1111-111111111111',
  guestSessionId: '22222222-2222-2222-2222-222222222222',
  mediaType: 'photo' as const,
  contentType: 'image/jpeg' as const,
  maxBytes: 30_000_000,
  filename: 'abc.jpg',
  uploaderName: 'Sam',
}

beforeAll(() => {
  process.env.UPLOAD_SIGNING_SECRET = 'test-secret-for-unit-tests'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('upload ticket sign/verify', () => {
  it('round-trips a signed payload', () => {
    const token = signUploadTicket(basePayload)
    const verified = verifyUploadTicket(token)
    expect(verified).not.toBeNull()
    expect(verified?.key).toBe(basePayload.key)
    expect(verified?.eventId).toBe(basePayload.eventId)
    expect(verified?.maxBytes).toBe(basePayload.maxBytes)
  })

  it('rejects a tampered payload body', () => {
    const token = signUploadTicket(basePayload)
    const [body, sig] = token.split('.')
    const forgedBody = Buffer.from(
      JSON.stringify({ ...basePayload, maxBytes: 999_999_999, exp: 9_999_999_999 }),
    ).toString('base64url')
    expect(verifyUploadTicket(`${forgedBody}.${sig}`)).toBeNull()
    // Sanity: the original still verifies.
    expect(verifyUploadTicket(`${body}.${sig}`)).not.toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = signUploadTicket(basePayload)
    const [body] = token.split('.')
    expect(verifyUploadTicket(`${body}.deadbeef`)).toBeNull()
  })

  it('rejects malformed tokens', () => {
    expect(verifyUploadTicket('not-a-token')).toBeNull()
    expect(verifyUploadTicket('')).toBeNull()
  })

  it('rejects an expired ticket', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signUploadTicket(basePayload)
    // Advance beyond the 30-minute TTL.
    vi.setSystemTime(new Date('2026-01-01T00:31:00Z'))
    expect(verifyUploadTicket(token)).toBeNull()
  })
})

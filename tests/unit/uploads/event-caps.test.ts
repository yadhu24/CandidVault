import { describe, expect, it } from 'vitest'
import {
  MAX_EVENT_TOTAL_BYTES,
  MAX_UPLOADS_PER_EVENT,
  evaluateUploadCap,
} from '@/lib/uploads/event-caps'

describe('evaluateUploadCap', () => {
  it('allows an upload well under both limits', () => {
    expect(evaluateUploadCap({ count: 0, totalBytes: 0 }, 1_000)).toEqual({ ok: true })
  })

  it('rejects when the count is at the cap', () => {
    expect(evaluateUploadCap({ count: MAX_UPLOADS_PER_EVENT, totalBytes: 0 }, 1)).toEqual({
      ok: false,
      reason: 'count',
    })
  })

  it('rejects when adding bytes would exceed the byte cap', () => {
    expect(evaluateUploadCap({ count: 1, totalBytes: MAX_EVENT_TOTAL_BYTES }, 1)).toEqual({
      ok: false,
      reason: 'bytes',
    })
  })

  it('allows hitting the byte cap exactly', () => {
    const usage = { count: 1, totalBytes: MAX_EVENT_TOTAL_BYTES - 10 }
    expect(evaluateUploadCap(usage, 10)).toEqual({ ok: true })
  })

  it('checks count before bytes', () => {
    const over = { count: MAX_UPLOADS_PER_EVENT, totalBytes: MAX_EVENT_TOTAL_BYTES + 1 }
    expect(evaluateUploadCap(over, 1)).toEqual({ ok: false, reason: 'count' })
  })
})

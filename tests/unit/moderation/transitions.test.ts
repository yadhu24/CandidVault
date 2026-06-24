import { describe, expect, it } from 'vitest'
import { DECISION_TO_STATUS } from '@/lib/db/queries/moderation'

describe('moderation decision → status', () => {
  it('maps each decision to the right moderation status', () => {
    expect(DECISION_TO_STATUS.approve).toBe('approved')
    expect(DECISION_TO_STATUS.reject).toBe('rejected')
    expect(DECISION_TO_STATUS.restore).toBe('pending')
  })

  it('covers exactly the supported decisions', () => {
    expect(Object.keys(DECISION_TO_STATUS).sort()).toEqual(['approve', 'reject', 'restore'])
  })
})

import { describe, expect, it } from 'vitest'
import { AlbumSchema } from '@/lib/validation/albums'

describe('AlbumSchema', () => {
  it('accepts a valid album', () => {
    expect(AlbumSchema.safeParse({ name: 'Ceremony' }).success).toBe(true)
  })

  it('trims and keeps the name', () => {
    const result = AlbumSchema.safeParse({ name: '  Reception  ' })
    expect(result.success && result.data.name).toBe('Reception')
  })

  it('rejects an empty name with a friendly message', () => {
    const result = AlbumSchema.safeParse({ name: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toBe('Give the album a name.')
  })

  it('rejects a name over 120 chars', () => {
    expect(AlbumSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false)
  })

  it('allows an optional description', () => {
    expect(AlbumSchema.safeParse({ name: 'A', description: 'notes' }).success).toBe(true)
    expect(AlbumSchema.safeParse({ name: 'A', description: '' }).success).toBe(true)
  })
})

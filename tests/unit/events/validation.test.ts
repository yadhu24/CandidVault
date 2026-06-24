import { describe, expect, it } from 'vitest'
import { CreateEventSchema, UpdateEventSchema } from '@/lib/validation/events'

const validCreate = {
  name: 'Priya & Sam Wedding',
  eventType: 'wedding',
  eventDate: '2026-09-12',
  venue: 'The Grand Hall',
  description: 'A lovely day',
}

describe('CreateEventSchema', () => {
  it('accepts a well-formed event', () => {
    const result = CreateEventSchema.safeParse(validCreate)
    expect(result.success).toBe(true)
  })

  it('trims the name', () => {
    const result = CreateEventSchema.safeParse({ ...validCreate, name: '  Hello  ' })
    expect(result.success && result.data.name).toBe('Hello')
  })

  it('rejects an empty name', () => {
    expect(CreateEventSchema.safeParse({ ...validCreate, name: '   ' }).success).toBe(false)
  })

  it('rejects a name over 120 chars', () => {
    expect(CreateEventSchema.safeParse({ ...validCreate, name: 'x'.repeat(121) }).success).toBe(false)
  })

  it('rejects an unknown event type', () => {
    expect(CreateEventSchema.safeParse({ ...validCreate, eventType: 'concert' }).success).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(CreateEventSchema.safeParse({ ...validCreate, eventDate: '12/09/2026' }).success).toBe(
      false,
    )
  })

  it('rejects an impossible calendar date', () => {
    // Matches the YYYY-MM-DD shape but is not a real date.
    expect(CreateEventSchema.safeParse({ ...validCreate, eventDate: '2026-13-40' }).success).toBe(
      false,
    )
  })

  it('allows venue and description to be omitted', () => {
    const rest = {
      name: validCreate.name,
      eventType: validCreate.eventType,
      eventDate: validCreate.eventDate,
    }
    expect(CreateEventSchema.safeParse(rest).success).toBe(true)
  })

  it('rejects a venue over 200 chars', () => {
    expect(CreateEventSchema.safeParse({ ...validCreate, venue: 'x'.repeat(201) }).success).toBe(
      false,
    )
  })
})

describe('UpdateEventSchema', () => {
  it('accepts a valid status', () => {
    const result = UpdateEventSchema.safeParse({ ...validCreate, status: 'active' })
    expect(result.success).toBe(true)
  })

  it('requires a status', () => {
    expect(UpdateEventSchema.safeParse(validCreate).success).toBe(false)
  })

  it('rejects an unknown status', () => {
    expect(UpdateEventSchema.safeParse({ ...validCreate, status: 'archived' }).success).toBe(false)
  })

  it('still enforces the inherited create rules', () => {
    expect(UpdateEventSchema.safeParse({ ...validCreate, name: '', status: 'draft' }).success).toBe(
      false,
    )
  })
})

import { describe, expect, it } from 'vitest'
import { generateEventSlug, randomSlugSuffix, slugify } from '@/lib/events/slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Grand Hall')).toBe('the-grand-hall')
  })

  it('collapses punctuation and spaces into single hyphens', () => {
    expect(slugify("Priya & Sam's Wedding!")).toBe('priya-sam-s-wedding')
  })

  it('strips leading/trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello')
  })

  it('strips diacritics', () => {
    expect(slugify('Café Münchën')).toBe('cafe-munchen')
  })

  it('falls back to "event" for empty/symbol-only input', () => {
    expect(slugify('')).toBe('event')
    expect(slugify('!!!')).toBe('event')
  })

  it('caps the base length at 60 chars', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  })
})

describe('randomSlugSuffix', () => {
  it('is 8 hex chars', () => {
    expect(randomSlugSuffix()).toMatch(/^[0-9a-f]{8}$/)
  })

  it('differs across calls', () => {
    expect(randomSlugSuffix()).not.toBe(randomSlugSuffix())
  })
})

describe('generateEventSlug', () => {
  it('combines a slug base with a random suffix', () => {
    expect(generateEventSlug('Test Event')).toMatch(/^test-event-[0-9a-f]{8}$/)
  })
})

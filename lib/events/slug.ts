import { randomBytes } from 'node:crypto'

// Human-readable, URL-safe base derived from the event title.
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'event'
}

// Random component appended to the base so public /e/[slug] URLs are not
// trivially guessable and so titles can collide without failing.
export function randomSlugSuffix(): string {
  return randomBytes(4).toString('hex')
}

export function generateEventSlug(title: string): string {
  return `${slugify(title)}-${randomSlugSuffix()}`
}

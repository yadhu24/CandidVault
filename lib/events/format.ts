// Formats a 'YYYY-MM-DD' calendar date for display without timezone drift.
// Parsing with an explicit midnight keeps the date stable across locales.
export function formatEventDate(date: string | null): string {
  if (!date) return 'Date TBD'
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

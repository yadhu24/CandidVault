// Internal analytics summary. Prints product-event counts (optionally scoped to a
// time window or one event), plus the upload + export funnels.
//
// Usage:
//   npm run analytics:summary
//   npm run analytics:summary -- --days 7
//   npm run analytics:summary -- --event <eventId>
import { getDb } from '@/lib/db/client'
import { getAnalyticsSummary } from '@/lib/db/queries/analytics'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

function parseArgs(argv: string[]): { days?: number; eventId?: string } {
  const out: { days?: number; eventId?: string } = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') out.days = Number(argv[++i])
    else if (argv[i] === '--event') out.eventId = argv[++i]
  }
  return out
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

async function main() {
  const { days, eventId } = parseArgs(process.argv.slice(2))
  const since =
    days && Number.isFinite(days)
      ? new Date(Date.now() - days * 86_400_000).toISOString()
      : undefined

  const rows = await getAnalyticsSummary({ since, eventId })
  const counts = new Map(rows.map((r) => [r.name, r.count]))
  const get = (name: string) => counts.get(name) ?? 0

  const scope = [
    eventId ? `event=${eventId}` : 'all events',
    since ? `last ${days}d` : 'all time',
  ].join(', ')

  console.log(`\nCandidVault analytics — ${scope}\n${'='.repeat(40)}`)
  for (const name of ANALYTICS_EVENTS) {
    console.log(`  ${name.padEnd(20)} ${String(get(name)).padStart(8)}`)
  }

  const started = get('upload_started')
  const completed = get('upload_completed')
  const failed = get('upload_failed')
  console.log(`\nUpload funnel\n${'-'.repeat(40)}`)
  console.log(`  started:   ${started}`)
  console.log(`  completed: ${completed} (${pct(completed, started)} of started)`)
  console.log(`  failed:    ${failed}`)

  const requested = get('export_requested')
  const exported = get('export_completed')
  console.log(`\nExport funnel\n${'-'.repeat(40)}`)
  console.log(`  requested: ${requested}`)
  console.log(`  completed: ${exported} (${pct(exported, requested)} of requested)\n`)
}

main()
  .catch((err) => {
    console.error('[analytics-summary] failed', err)
    process.exitCode = 1
  })
  .finally(() => getDb().end())

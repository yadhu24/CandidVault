import { query, queryOne } from '../query'
import type { AnalyticsActorType, AnalyticsEvent } from '../types'

export interface InsertAnalyticsEventInput {
  name: string
  eventId?: string | null
  actorId?: string | null
  actorType?: AnalyticsActorType
  properties?: Record<string, unknown>
}

export function insertAnalyticsEvent(
  input: InsertAnalyticsEventInput,
): Promise<AnalyticsEvent | null> {
  return queryOne<AnalyticsEvent>(
    `INSERT INTO analytics_events (name, event_id, actor_id, actor_type, properties)
     VALUES ($1, $2, $3, COALESCE($4, 'system'), $5::jsonb)
     RETURNING *`,
    [
      input.name,
      input.eventId ?? null,
      input.actorId ?? null,
      input.actorType ?? null,
      JSON.stringify(input.properties ?? {}),
    ],
  )
}

export interface AnalyticsSummaryRow {
  name: string
  count: number
}

export interface AnalyticsSummaryOptions {
  eventId?: string
  since?: string // ISO timestamp, inclusive
  until?: string // ISO timestamp, exclusive
}

// Counts grouped by event name, optionally scoped to one event and/or a time
// window. Filters are built from $N placeholders only — no string interpolation
// of inputs. Backed by idx_analytics_events_name_created (+ the event index).
export function getAnalyticsSummary(
  opts: AnalyticsSummaryOptions = {},
): Promise<AnalyticsSummaryRow[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  if (opts.eventId) {
    params.push(opts.eventId)
    conditions.push(`event_id = $${params.length}`)
  }
  if (opts.since) {
    params.push(opts.since)
    conditions.push(`created_at >= $${params.length}`)
  }
  if (opts.until) {
    params.push(opts.until)
    conditions.push(`created_at < $${params.length}`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return query<AnalyticsSummaryRow>(
    `SELECT name, COUNT(*)::int AS count
     FROM analytics_events
     ${where}
     GROUP BY name
     ORDER BY count DESC, name`,
    params,
  )
}

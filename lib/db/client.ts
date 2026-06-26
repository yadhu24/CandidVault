// Thin wrapper so all DB access goes through one import.
// Swap the underlying driver here without touching callers.
import { Pool, types } from 'pg'

// Make pg's output line up with the domain types in ./types:
//   * int8/bigint -> JS number. File sizes and counts stay well within
//     Number.MAX_SAFE_INTEGER, so this is safe and avoids string-typed fields.
//   * timestamps  -> ISO 8601 strings (JSON-friendly, stable across the wire).
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)))
const toIso = (v: string | null) => (v === null ? null : new Date(v).toISOString())
types.setTypeParser(types.builtins.TIMESTAMPTZ, toIso)
types.setTypeParser(types.builtins.TIMESTAMP, toIso)
// Keep DATE as the raw 'YYYY-MM-DD' string — avoids the timezone shift that
// pg's default Date parsing introduces for calendar-only values (e.g. event_date).
types.setTypeParser(types.builtins.DATE, (v) => v)

let pool: Pool | undefined

// Managed Postgres (Supabase, etc.) requires TLS; local dev does not. Decide by
// host so localhost stays plain and hosted connections are encrypted. Set
// DATABASE_SSL=disable to force it off.
function requiresSsl(connectionString: string | undefined): boolean {
  if (!connectionString || process.env.DATABASE_SSL === 'disable') return false
  try {
    const host = new URL(connectionString).hostname
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1'
  } catch {
    return false
  }
}

// Connection-pool tuning. Conservative defaults sized for the Supabase Supavisor
// session pooler (one server connection pinned per client connection): keep the
// per-process cap small, fail fast instead of waiting forever for a connection,
// release idle connections promptly, and recycle long-lived ones so the pooler can
// rebalance. Tune `max` per deployment via DATABASE_POOL_MAX (small for the
// horizontally-scaled web app, a bit higher for the single long-lived worker).
const DEFAULT_POOL_MAX = 5
const POOL_IDLE_TIMEOUT_MS = 10_000
const POOL_CONNECTION_TIMEOUT_MS = 10_000
const POOL_MAX_USES = 7_500

function poolMax(): number {
  const raw = Number(process.env.DATABASE_POOL_MAX)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_POOL_MAX
}

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    pool = new Pool({
      connectionString,
      ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: poolMax(),
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
      maxUses: POOL_MAX_USES,
      keepAlive: true,
      // Tags connections in pg_stat_activity so app vs worker traffic is
      // distinguishable on the Supabase dashboard. Set PG_APPLICATION_NAME per
      // deployment (e.g. candidvault-web / candidvault-worker).
      application_name: process.env.PG_APPLICATION_NAME ?? 'candidvault',
    })
    // A pooled connection can emit 'error' while idle (the server or pooler closes
    // it). pg surfaces this on the Pool; with no handler Node treats it as an
    // unhandled 'error' and crashes the process. Log it and let pg discard the bad
    // client — getDb() callers transparently get a fresh one.
    pool.on('error', (err) => {
      console.error('[db] idle pool client error', { name: err.name })
    })
  }
  return pool
}

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

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

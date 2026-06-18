// Thin wrapper so all DB access goes through one import.
// Swap the underlying driver here without touching callers.
import { Pool } from 'pg'

let pool: Pool | undefined

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

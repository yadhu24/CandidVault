import type { PoolClient, QueryResultRow } from 'pg'
import { getDb } from './client'

// All callers go through these helpers. Rules:
//   * Parameterized SQL only — never interpolate user input (CLAUDE.md §10).
//   * DB columns are snake_case; rows are mapped to camelCase here once, so the
//     rest of the app speaks camelCase and matches the types in ./types.

type Queryable = Pick<PoolClient, 'query'>

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

// Shallow on purpose: only the row's own column names are camelized. Values are
// returned untouched so jsonb payloads (e.g. uploads.metadata) keep their keys.
function camelizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const key in row) out[snakeToCamel(key)] = row[key]
  return out as T
}

export async function query<T>(
  text: string,
  params: readonly unknown[] = [],
  client: Queryable = getDb(),
): Promise<T[]> {
  const result = await client.query<QueryResultRow>(text, params as unknown[])
  return result.rows.map((r) => camelizeRow<T>(r))
}

export async function queryOne<T>(
  text: string,
  params: readonly unknown[] = [],
  client: Queryable = getDb(),
): Promise<T | null> {
  const rows = await query<T>(text, params, client)
  return rows[0] ?? null
}

// Pagination defaults for any list that can grow (CLAUDE.md §5). Callers pass
// limit/offset; resolvePage clamps them so a client can't request an unbounded page.
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

export interface PageOptions {
  limit?: number
  offset?: number
}

export function resolvePage(opts: PageOptions = {}): { limit: number; offset: number } {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const offset = Math.max(0, opts.offset ?? 0)
  return { limit, offset }
}

// Runs fn inside a single transaction; commits on success, rolls back on throw.
// Pass the provided client into query/queryOne so the work joins the transaction.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDb().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

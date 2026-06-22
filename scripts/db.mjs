import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
export const projectRoot = join(here, '..')

// Minimal .env loader so `npm run db:*` works after copying .env.example -> .env,
// without taking on a dependency. Only fills vars that aren't already set, so a
// real environment (CI, container) always wins.
export function loadEnv() {
  const envPath = join(projectRoot, '.env')
  if (!existsSync(envPath)) return
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

export function getConnectionString() {
  loadEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'DATABASE_URL is not set. Copy .env.example to .env and set it, or export it in your shell.',
    )
    process.exit(1)
  }
  return url
}

// Managed Postgres (Supabase, etc.) requires TLS; local dev does not.
function requiresSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'disable') return false
  try {
    const host = new URL(connectionString).hostname
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1'
  } catch {
    return false
  }
}

export function createClient() {
  const connectionString = getConnectionString()
  return new pg.Client({
    connectionString,
    ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  })
}

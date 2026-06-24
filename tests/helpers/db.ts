import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client } from 'pg'

// Integration tests run against a REAL Postgres given by DATABASE_URL_TEST.
// They are skipped when it's absent, so `npm test` stays green without infra.
//
// Safety: we require a dedicated DATABASE_URL_TEST and point the app's pool at it
// (the query layer reads DATABASE_URL). resetTables() refuses to run unless the
// two match, so it can never truncate a non-test database.
export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST
export const hasTestDb = Boolean(TEST_DATABASE_URL)

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationsDir = join(rootDir, 'migrations')

// Tables holding test data, child-first so truncating respects FKs. (TRUNCATE ...
// CASCADE would also work; explicit order documents the graph.)
const DATA_TABLES = [
  'analytics_events',
  'moderation_actions',
  'album_items',
  'albums',
  'upload_variants',
  'uploads',
  'exports',
  'guest_sessions',
  'event_qr_codes',
  'events',
  'photographer_profiles',
  'users',
]

function newClient(): Client {
  if (!TEST_DATABASE_URL) throw new Error('DATABASE_URL_TEST is not set')
  return new Client({ connectionString: TEST_DATABASE_URL })
}

// Applies all migrations once, idempotently (mirrors scripts/migrate.mjs). Safe to
// call repeatedly — already-applied files are skipped via the schema_migrations
// ledger. Also points the app pool at the test DB for the query layer.
export async function setupTestDatabase(): Promise<void> {
  if (!TEST_DATABASE_URL) return
  process.env.DATABASE_URL = TEST_DATABASE_URL

  const client = newClient()
  await client.connect()
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    )
    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    )
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

// Empties all data tables between tests. Guarded so it can only ever hit the test DB.
export async function resetTables(): Promise<void> {
  if (!TEST_DATABASE_URL || process.env.DATABASE_URL !== TEST_DATABASE_URL) return
  const client = newClient()
  await client.connect()
  try {
    await client.query(`TRUNCATE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`)
  } finally {
    await client.end()
  }
}

// --- raw fixtures (prerequisites; the behavior under test uses the real lib fns) ---

export interface SeededPhotographer {
  id: string
  email: string
}

export async function seedPhotographer(
  overrides: Partial<SeededPhotographer> = {},
): Promise<SeededPhotographer> {
  const id = overrides.id ?? randomUUID()
  const email = overrides.email ?? `photographer-${id.slice(0, 8)}@example.com`
  const client = newClient()
  await client.connect()
  try {
    await client.query(
      `INSERT INTO users (id, email, role) VALUES ($1, lower($2), 'photographer')
       ON CONFLICT (id) DO NOTHING`,
      [id, email],
    )
    await client.query(
      `INSERT INTO photographer_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [id],
    )
  } finally {
    await client.end()
  }
  return { id, email }
}

export interface SeedEventInput {
  photographerId: string
  name?: string
  status?: 'draft' | 'active' | 'closed'
  eventType?: string
}

export async function seedEvent(input: SeedEventInput): Promise<{ id: string; slug: string }> {
  const id = randomUUID()
  const slug = `evt-${id.slice(0, 8)}`
  const client = newClient()
  await client.connect()
  try {
    await client.query(
      `INSERT INTO events (id, photographer_id, slug, name, event_type, status, event_date)
       VALUES ($1, $2, $3, $4, $5, $6, '2026-01-01')`,
      [
        id,
        input.photographerId,
        slug,
        input.name ?? 'Test Event',
        input.eventType ?? 'wedding',
        input.status ?? 'active',
      ],
    )
  } finally {
    await client.end()
  }
  return { id, slug }
}

export interface SeedUploadInput {
  eventId: string
  moderationStatus?: 'pending' | 'approved' | 'rejected'
  mediaType?: 'photo' | 'video'
  fileSizeBytes?: number
}

export async function seedUpload(input: SeedUploadInput): Promise<{ id: string; storageKey: string }> {
  const id = randomUUID()
  const storageKey = `events/${input.eventId}/originals/${id}.jpg`
  const client = newClient()
  await client.connect()
  try {
    await client.query(
      `INSERT INTO uploads
         (id, event_id, media_type, mime_type, file_size_bytes, storage_key, moderation_status)
       VALUES ($1, $2, $3, 'image/jpeg', $4, $5, $6)`,
      [
        id,
        input.eventId,
        input.mediaType ?? 'photo',
        input.fileSizeBytes ?? 1_000_000,
        storageKey,
        input.moderationStatus ?? 'pending',
      ],
    )
  } finally {
    await client.end()
  }
  return { id, storageKey }
}

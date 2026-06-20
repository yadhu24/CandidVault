import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient, projectRoot } from './db.mjs'

// Applies pending SQL migrations in filename order and records each in a
// schema_migrations ledger so re-running is a no-op. Each migration runs as one
// statement batch inside its own transaction — pg's simple-query protocol sends
// the whole file at once, which handles dollar-quoted function bodies fine, so
// there is no fragile semicolon-splitting here.
const MIGRATIONS_DIR = join(projectRoot, 'migrations')

async function main() {
  const client = createClient()
  await client.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    )
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let count = 0
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      process.stdout.write(`applying ${file} ... `)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log('ok')
        count++
      } catch (err) {
        await client.query('ROLLBACK')
        console.log('failed')
        throw err
      }
    }
    console.log(count === 0 ? 'already up to date' : `applied ${count} migration(s)`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

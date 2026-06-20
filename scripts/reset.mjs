import { createClient } from './db.mjs'

// Dev-only: drops and recreates the public schema (wiping all tables + the
// migration ledger). Guarded against production. Wire-up in package.json runs
// migrate + seed afterwards.
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to reset the database with NODE_ENV=production.')
    process.exit(1)
  }
  const client = createClient()
  await client.connect()
  try {
    console.log('dropping and recreating schema "public" ...')
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
    console.log('done')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

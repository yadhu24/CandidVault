# Migrations

Versioned, append-only SQL migrations (CLAUDE.md §6). Files are applied in
filename order and are **immutable once merged** — fix mistakes with a new file,
never by editing an existing one.

## Naming

Zero-padded sequence prefix + intent, e.g. `0002_add_upload_checksum_index.sql`.
Use the `create-migration` skill (`.claude/skills/create-migration`) to scaffold
one with the right header and expand/contract guidance.

## Local workflow

Requires `DATABASE_URL` (copy `.env.example` to `.env` and set it, or export it).

```bash
npm run db:migrate   # apply any pending migrations
npm run db:seed      # load idempotent local fixtures
npm run db:reset     # DEV ONLY: drop schema, re-migrate, re-seed
```

The runner records applied files in a `schema_migrations` table, so
`db:migrate` is safe to run repeatedly. `db:reset` refuses to run when
`NODE_ENV=production`.

## How migrations are applied

Each file runs as a single statement batch inside its own transaction. That
keeps dollar-quoted function bodies (`$$ ... $$`) intact and makes a failed
migration roll back cleanly. Avoid statements that cannot run inside a
transaction (e.g. `CREATE INDEX CONCURRENTLY`); if one is ever needed, give it
its own migration and note it in the header.

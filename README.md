# CandidVault

QR-based guest photo & video collection platform for events. Built for
photographers to collect, moderate and export guest memories.

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · PostgreSQL · Supabase Auth ·
Cloudflare R2 · a background worker (thumbnails, metadata extraction, ZIP export).

## Local setup

Prerequisites: **Node 20+**, a **Postgres** database, a **Supabase** project
(Auth), and a **Cloudflare R2** bucket.

```bash
npm install
cp .env.example .env          # fill in the values (see comments in the file)
npm run db:migrate            # apply migrations to your database
npm run dev                   # app on http://localhost:3000
npm run worker                # SECOND terminal — processes uploads + builds exports
```

- `npm run db:seed` adds sample data (optional); `npm run db:reset` wipes + re-seeds.
- The **worker is a separate process** and must be running for thumbnails, video
  posters/metadata, and ZIP exports. The app works without it, but media stays
  unprocessed and exports never finish.
- For the guest flow to accept uploads, an event must be **Active** (publish it on
  the event's Settings tab). New events start as Draft.
- `npm test` (unit + integration), `npm run typecheck`, `npm run lint` before pushing.

## Deployment

The app is a standard Next.js app; the worker is the one extra process.

1. **App** — deploy to Vercel (or any Next host). Set every env var from
   `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the production domain. If `main`
   is connected to Vercel it auto-deploys on push.
2. **Worker** — ⚠️ **cannot run on Vercel** (it's a long-running poll loop, not a
   request handler). Run it on an always-on host (Railway / Render / Fly / a small
   VM). A ready-to-deploy [`Dockerfile.worker`](./Dockerfile.worker) (Node +
   `ffmpeg`) and [`railway.json`](./railway.json) are included — on Railway, add a
   new service from this repo and it builds the Dockerfile and runs `npm run
   worker` with an auto-restart policy. The worker needs only `DATABASE_URL` and
   the four `R2_*` vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) — **not** the Supabase keys or
   `UPLOAD_SIGNING_SECRET`. It exposes no HTTP port, so it needs no public domain.
   The worker writes a heartbeat to the DB; point an uptime monitor at the app's
   **`GET /api/health`** (200 = DB reachable + a worker beat in the last 60s;
   503 = degraded) to get alerted if it dies. Set `WORKER_ID` if you run more than
   one worker and want stable identifiers.
3. **Database** — run `npm run db:migrate` against the production database as part
   of each deploy that adds a migration (or apply the SQL via the Supabase editor;
   keep the `schema_migrations` ledger in sync).
4. **R2** — the bucket must be **private**. Configure CORS to allow `PUT`/`GET`/
   `HEAD` from the app origin with `ExposeHeaders: ETag` (required for multipart),
   and add lifecycle rules to abort incomplete multipart uploads (~1 day) and
   expire the `exports/` prefix after the retention window (7 days).

**Pilot launch?** See [`docs/pilot-readiness.md`](./docs/pilot-readiness.md) for
the operator, QA, support, triage, and release checklists.

## Working with Claude in this repo

This repository is set up to be worked on with Claude (and other AI agents).
The rules of engagement live in [`CLAUDE.md`](./CLAUDE.md) — **read it first.**
In short:

- **Read `CLAUDE.md` before changing anything.** It defines architecture,
  folder/naming/API/migration conventions, security guardrails, testing and
  logging expectations, and a "do not do" list. Those rules are binding unless
  explicitly overridden in a task.
- **Work in small, safe increments.** One concern per change; keep the repo
  working and reviewable at every step; verify with type checks, lint, and
  tests before calling a step done.
- **Be conservative with storage, auth, and security.** Such changes must be
  small, reversible, and clearly explained, with sign-off before anything that
  widens access or affects existing data.
- **Prefer the simple monolith.** One Next.js app plus the one background
  worker. Propose (don't add) extra architecture, and wait for approval.
- **Comment only where it helps.** Explain the *why*; don't narrate obvious
  code.

Reusable task playbooks live in [`.claude/skills/`](./.claude/skills/) — see
that directory's README for the structure and how to extend it.

## Documentation

Feature and operational docs live in [`docs/`](./docs):

- [`design-system.md`](./docs/design-system.md) — tokens, components, usage rules
- [`upload-processing.md`](./docs/upload-processing.md) — the upload → worker pipeline
- [`resumable-uploads.md`](./docs/resumable-uploads.md) — chunked/resumable upload flow
- [`exports.md`](./docs/exports.md) — ZIP export streaming + retention
- [`analytics.md`](./docs/analytics.md) — product event schema + instrumentation
- [`security.md`](./docs/security.md) — abuse-prevention posture + manual infra
- [`testing.md`](./docs/testing.md) — test strategy, layers, and what needs manual QA
- [`pilot-readiness.md`](./docs/pilot-readiness.md) — operator, QA, support, triage & release checklists
- [`backlog.md`](./docs/backlog.md) — next-phase backlog (bugs, hardening, UX, perf, AI, features) with priorities

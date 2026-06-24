# Testing

CandidVault uses a three-layer strategy, each layer testing what it's best at and
nothing it isn't:

| Layer | Tool | Runs against | What it proves |
|---|---|---|---|
| **Unit** | Vitest | pure functions, no I/O | validation, slug, ticket, caps, mappings |
| **Integration** | Vitest | a real Postgres + real query/action layer | SQL correctness, transactions, idempotency, ownership scoping |
| **E2E** | Playwright | a running app (DB + Supabase + R2) | real user journeys end to end |

## Stack choice

- **Vitest** — TS/ESM-native, fast, same `@/…` path alias as the app, no Babel/Jest
  config drift. Used for both unit and integration (integration just adds a DB).
- **Playwright** — reliable cross-browser E2E with auto-waiting; good at the
  upload/clipboard/file-input flows CandidVault depends on.

No new runtime dependencies — these are all `devDependencies`.

## Running

```bash
npm test                 # unit + integration (integration skips without a test DB)
npm run test:unit        # unit only — always runnable, no infra
npm run test:integration # integration only
npm run test:watch       # vitest watch mode
npm run test:coverage    # v8 coverage over lib/
npm run test:e2e         # Playwright (needs a running app)
```

### Unit (no setup)

`tests/unit/**` run anywhere. Coverage today:

- **event creation validation** — `CreateEventSchema` / `UpdateEventSchema`
- **slug generation** — `slugify`, `randomSlugSuffix`, `generateEventSlug`
- **upload session validation** — `CreateUploadSessionSchema`, `PresignPartsSchema`,
  `ConfirmUploadSchema`, mime helpers, **per-event cap** (`evaluateUploadCap`)
- **upload ticket** — HMAC sign/verify, tamper + expiry rejection (security-critical)
- **moderation transitions** — `DECISION_TO_STATUS`
- **album operations** — `AlbumSchema` (name/length rules)

### Integration (needs a throwaway Postgres)

Set `DATABASE_URL_TEST` to a **dedicated** database (never prod/dev — the helper
truncates between tests and refuses to run unless the app pool points at exactly
that URL):

```bash
DATABASE_URL_TEST=postgres://localhost:5432/candidvault_test npm run test:integration
```

`tests/helpers/db.ts` applies all migrations once (idempotent, same ledger as
`scripts/migrate.mjs`), truncates between tests, and provides raw seed fixtures
(`seedPhotographer`, `seedEvent`, `seedUpload`). The behavior under test always
uses the **real** lib functions; seeds are just prerequisites.

Server Actions are exercised with the Next runtime edges mocked (`requirePhotographer`,
`next/cache`, `next/navigation`, `next/server`) and a real DB — so the action's
auth/ownership/validation wiring is tested, not stubbed. Coverage:

- **authenticated event creation** — action creates + redirects; invalid input
  returns field errors; cross-photographer reads return null (ownership)
- **upload completion registration** — `registerUpload` idempotency on `storage_key`;
  `getEventUploadUsage` aggregation
- **moderation actions** — approve/reject, audit rows, idempotent no-ops,
  cross-event id rejection, non-owner refusal, bulk counts
- **export request flow** — pending creation, in-flight de-dupe, zero-approved
  refusal, non-owner refusal, worker `claim → ready` + scoped reads
- **album operations** — create, idempotent add, scoped reads, list, remove

### E2E (needs a running app)

```bash
npx playwright install            # one-time: download browsers
E2E_BASE_URL=http://localhost:3000 \
E2E_EMAIL=you@example.com E2E_PASSWORD=… \
npm run test:e2e
```

Each spec **skips itself** when its prerequisites are missing, so the suite is
safe to run anywhere. Env knobs (see `tests/e2e/support.ts`): `E2E_BASE_URL`,
`E2E_EMAIL`/`E2E_PASSWORD` (an existing **confirmed** account), `E2E_EVENT_SLUG`,
and `E2E_FULL=1` to opt into the storage-touching flow. Coverage:

- **signup/login** (`auth.spec.ts`) — signup reaches the email-confirmation prompt;
  login lands on the dashboard
- **create event + open public page** (`event.spec.ts`) — create, publish via
  Settings, open `/e/[slug]`, see the uploader
- **upload → approve → export** (`full-flow.spec.ts`, `E2E_FULL=1`) — guest uploads
  a tiny JPEG, photographer approves it, requests an export

> Selectors are written against the current UI text/roles; validate them on the
> first real run and adjust if the UI copy changes.

## Fixtures & mocks (kept minimal)

- `tests/helpers/db.ts` — migrate/reset + raw row seeders (integration).
- Inline `vi.mock` of the Next runtime edges in action integration tests.
- `tinyJpeg()` in `tests/e2e/support.ts` — a 1×1 JPEG buffer, so no binary fixture
  file is needed for the upload spec.

## What still requires manual QA

Automated tests deliberately stop at the storage boundary. These need a real
environment and human verification:

- **The actual file transfer to R2** — presigned single PUT, multipart part PUTs,
  ETag exposure (CORS `ExposeHeaders: ETag`), and CORS for `PUT`/`GET`/`HEAD` from
  the app origin. The unit/integration tests cover ticket signing, validation, and
  the DB registration around it, but never move bytes. `E2E_FULL` touches the real
  path but still assumes a correctly configured bucket.
- **Resumable upload behavior** — dropping/restoring connection mid-multipart,
  resuming only missing parts, ticket expiry → restart. Hard to simulate reliably;
  verify on a real flaky network / by killing the tab mid-upload.
- **Client-side image compression & HEIC** — canvas compression and the server-side
  HEIC→JPEG transcode depend on browser/`sharp` capabilities; spot-check real
  iPhone HEIC and large images.
- **Worker processing** — thumbnail/preview/`web` variant generation, EXIF/dimension
  extraction, video poster/duration via ffmpeg (and the no-ffmpeg fallback), and
  **ZIP export assembly/streaming**. Run the worker and inspect outputs; the export
  E2E only *requests* a build, it doesn't wait for or download the ZIP.
- **Signed-download links** — that a `ready` export's link downloads and that an
  expired one is refused (410).
- **Supabase email flows** — signup confirmation and magic-link emails can't be
  automated without an inbox harness.
- **Rate limiting at scale** — the in-memory limiter is per-process; real
  multi-instance limiting needs the shared store noted in `docs/security.md`.

## Notes

- Integration is intentionally at the query/action layer rather than over HTTP —
  it's where the real risk (SQL, scoping, idempotency) lives, and it stays fast and
  deterministic. The HTTP/runtime wiring is covered by E2E.
- CI: run `npm run test:unit` everywhere; run `npm run test:integration` where a
  disposable Postgres is available; run E2E in a stage that has the app + secrets.

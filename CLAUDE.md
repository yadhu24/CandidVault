# CLAUDE.md — CandidVault

Guidance for Claude (and any AI agent) working in this repository. Read this
before making changes. These rules are binding unless the user explicitly
overrides them in a given task.

---

## 1. Project overview

**CandidVault** is a photographer-first, QR-based event photo & video
collection platform. Photographers create an event, share a QR code, and
guests upload photos/videos to that event. Photographers then moderate,
organize, and export the collected media.

Core flows:

- **Photographer**: sign up → create event → get QR/link → moderate uploads →
  export (ZIP).
- **Guest**: scan QR → land on event page → upload photos/videos (usually
  without an account) → see confirmation.
- **Background processing**: uploaded media is processed asynchronously to
  generate thumbnails, extract metadata (EXIF, dimensions, duration), and build
  on-demand ZIP exports.

### Tech stack

| Concern              | Choice                                            |
| -------------------- | ------------------------------------------------- |
| Framework            | Next.js (App Router) + React + TypeScript         |
| Styling              | Tailwind CSS                                      |
| Database             | PostgreSQL                                        |
| Auth                 | Supabase Auth                                     |
| Object storage       | Cloudflare R2 (S3-compatible)                     |
| Async work           | A background worker (thumbnails, metadata, ZIP)   |

---

## 2. Architecture rules

- **Prefer a simple monolith.** A single Next.js application is the default for
  all product code. Do not introduce microservices, message buses, separate
  gateway services, or multi-repo splits unless the user explicitly asks. See
  rule 14.
- **The only separate process is the background worker**, and only because
  thumbnailing, metadata extraction, and ZIP export are long-running and must
  not block request handlers. Keep the worker in the same repo and share types
  with the web app.
- **Layering.** Keep a clear separation:
  - `app/` — routing, pages, route handlers (thin; no business logic).
  - `lib/` (or `src/lib/`) — business logic, data access, integrations. This is
    where real work lives and is unit-testable without HTTP.
  - Route handlers and Server Actions call into `lib/`; they validate input,
    check auth, call a service function, and shape the response. Nothing more.
- **One source of truth per concern.** Storage access goes through one R2
  module, auth through one Supabase module, DB access through one db module. Do
  not scatter direct SDK calls across the codebase.
- **Server-only secrets stay server-only.** R2 credentials, the database URL,
  Supabase service-role keys, and signing secrets must never be imported into
  client components or shipped in the client bundle.
- **Media never flows through the app server when avoidable.** Guests upload to
  R2 via short-lived presigned URLs; the app issues the URL and records
  metadata. The app server is not a file proxy for large media.
- **Idempotency for async work.** Worker jobs must be safe to retry. Use a job
  status column and design handlers so re-running a job does not duplicate
  thumbnails, rows, or exports.

---

## 3. Folder structure rules

Use this layout. Create directories as needed; keep new code inside the
established homes rather than inventing new top-level folders.

```
candidvault/
├── app/                      # Next.js App Router (pages, layouts, route handlers)
│   ├── (marketing)/          # Public marketing/landing routes
│   ├── (dashboard)/          # Authenticated photographer routes
│   ├── e/[eventId]/          # Public guest upload routes (QR target)
│   └── api/                  # Route handlers (REST-ish endpoints)
├── components/               # Reusable React components (presentational + UI)
│   └── ui/                   # Low-level UI primitives
├── lib/                      # Business logic & integrations (server-side)
│   ├── auth/                 # Supabase auth helpers, session, guards
│   ├── db/                   # DB client, queries, types
│   ├── storage/              # Cloudflare R2 client, presigned URLs
│   ├── media/                # Thumbnail/metadata helpers shared with worker
│   └── validation/           # Zod (or equivalent) schemas
├── worker/                   # Background worker entry + job handlers
├── migrations/               # SQL migrations (ordered, immutable once merged)
├── tests/                    # Tests mirroring source structure
├── public/                   # Static assets
└── CLAUDE.md
```

- Components are colocated by feature when they are feature-specific; shared
  primitives live in `components/ui/`.
- Server-only modules (anything in `lib/storage`, `lib/db`, `lib/auth` server
  helpers) must not be imported by client components.
- The worker imports from `lib/` to reuse logic; it must not import from `app/`.

---

## 4. Naming conventions

- **Files**: React components `PascalCase.tsx` (e.g. `UploadDropzone.tsx`).
  Non-component TS modules `kebab-case.ts` (e.g. `presigned-url.ts`). Route
  files follow Next.js conventions (`page.tsx`, `route.ts`, `layout.tsx`).
- **Directories**: `kebab-case`.
- **Variables/functions**: `camelCase`. **Types/interfaces/components/React
  hooks-as-types**: `PascalCase`. **Constants**: `UPPER_SNAKE_CASE`.
- **Booleans** read as predicates: `isProcessing`, `hasThumbnail`,
  `canExport`.
- **Database**: tables and columns `snake_case`, plural table names (`events`,
  `media_assets`, `upload_jobs`). Primary keys `id`; foreign keys
  `<entity>_id` (`event_id`). Timestamps `created_at`, `updated_at`.
- **Env vars**: `UPPER_SNAKE_CASE`. Client-exposed vars must be prefixed
  `NEXT_PUBLIC_`; everything else is server-only by definition.
- **API routes**: lowercase, plural nouns, hyphenated where needed
  (`/api/events`, `/api/events/{id}/media`).

---

## 5. API design conventions

- **Style**: resource-oriented JSON over the route handlers in `app/api/`.
  Plural nouns, nested by ownership (`/api/events/{eventId}/media`).
- **HTTP semantics**: `GET` read, `POST` create, `PATCH` partial update,
  `DELETE` remove. Use correct status codes (`200`, `201`, `400`, `401`,
  `403`, `404`, `409`, `422`, `500`).
- **Validate every input** at the boundary with a schema (Zod or equivalent)
  before touching the DB or storage. Never trust client-supplied
  `userId`/`eventId` for authorization — derive identity from the session.
- **Consistent response shape.** Success returns the resource (or
  `{ data: ... }`); errors return a stable shape:
  ```json
  { "error": { "code": "EVENT_NOT_FOUND", "message": "Human-readable detail" } }
  ```
  Do not leak stack traces, SQL, or internal identifiers in error messages.
- **Pagination** for any list that can grow (media, events): cursor or
  limit/offset, with a sane default and hard max page size.
- **Uploads**: client requests a presigned URL from the API, uploads directly
  to R2, then calls a confirmation endpoint that records the asset and enqueues
  processing. Never accept large binaries through a JSON handler.
- **Idempotency**: accept an idempotency key on create-type endpoints that may
  be retried (e.g. upload confirmation) where practical.

---

## 6. DB migration conventions

- **All schema changes go through versioned SQL migrations** in `migrations/`.
  No manual changes to production schema, and no ORM auto-sync against real
  databases.
- **Migrations are append-only and ordered** (timestamp or zero-padded
  sequence prefix, e.g. `0007_add_media_status.sql`). Once a migration is
  merged, treat it as immutable — fix mistakes with a new migration.
- **Prefer expand/contract for anything risky.** Add columns/tables first
  (nullable or defaulted), backfill, switch the app, then remove the old shape
  in a later migration. Avoid destructive changes in the same migration that
  introduces the new shape.
- **Every migration should be reviewable in isolation**: state intent in a
  comment header, and call out anything that locks a large table, rewrites
  rows, or drops data.
- **Destructive operations** (`DROP`, `DELETE`, type narrowing,
  `NOT NULL` on populated columns) require explicit explanation and explicit
  user sign-off — see rule 12.
- Keep indexes intentional: add them for real query patterns, name them
  predictably, and note the query they serve.

---

## 7. Security guardrails

- **Authorization on every request.** Identity comes from the Supabase session,
  never from request body/query params. Every photographer-scoped resource is
  checked for ownership before read or write.
- **Guest uploads are untrusted.** Validate file type and size server-side
  before issuing a presigned URL; constrain the presigned URL to the expected
  content type, size, and key prefix; set a short expiry. Never let a guest
  choose an arbitrary storage key.
- **Storage isolation.** Object keys are namespaced by event
  (`events/{eventId}/...`). Buckets are private; access is only via
  short-lived presigned URLs. No public bucket listing.
- **Secrets** live in environment variables, never in the repo. Maintain
  `.env.example` with names only (never values). Service-role keys and R2
  credentials are server-only.
- **Validate and sanitize** all user input; rely on parameterized queries (no
  string-built SQL). Escape/encode output appropriately.
- **Rate-limit** public, unauthenticated endpoints (presign, upload confirm,
  event landing) to limit abuse.
- **Do not log secrets or PII.** Tokens, signed URLs, credentials, and guest
  contact details must never reach logs.
- **Conservative by default**: any change touching auth, storage access, or
  security boundaries follows rule 12 — small, reversible, and explained.

---

## 8. Testing expectations

- **Business logic in `lib/` is unit-tested.** Pure functions (validation,
  metadata parsing, key generation, authorization checks) get direct tests;
  these are the highest-value tests and should not require a running server.
- **Route handlers get integration-style tests** for the happy path plus the
  important failure paths (unauthorized, not found, invalid input).
- **Worker job handlers are tested for idempotency** — running a job twice
  produces the same result without duplication.
- **Test files mirror source**: `lib/storage/presigned-url.ts` →
  `tests/lib/storage/presigned-url.test.ts` (or a colocated `*.test.ts`,
  whichever pattern the repo settles on — be consistent).
- A change that fixes a bug should come with a test that fails before the fix.
- Do not delete or weaken tests to make a build pass. If a test is wrong, fix
  it deliberately and say why.

---

## 9. Logging & error handling expectations

- **Structured logging.** Log as structured data (level + message + context
  object), not free-form string concatenation. Include correlation context
  (request id, event id, job id) where available — but never secrets/PII.
- **Fail loudly on the server, gracefully on the client.** Server: throw/return
  typed errors, log at the boundary, return the consistent error shape from
  rule 5. Client: show actionable, friendly messages; never surface raw
  internal errors to guests.
- **No silent catches.** Do not swallow errors with empty `catch {}`. Either
  handle meaningfully, log and rethrow, or convert to a typed domain error.
- **Worker errors** are recorded against the job (status + error detail) so
  failures are observable and retryable, not lost.
- Use appropriate levels: `error` (needs attention), `warn` (recoverable/
  unexpected), `info` (lifecycle/business events), `debug` (development only).

---

## 10. "Do not do" list

- ❌ Do not commit secrets, real `.env` files, credentials, or signed URLs.
- ❌ Do not weaken or bypass auth/ownership checks "to make it work."
- ❌ Do not make buckets public or issue long-lived/over-broad presigned URLs.
- ❌ Do not proxy large media uploads/downloads through the app server.
- ❌ Do not add microservices, queues-as-infra, or new top-level services
  without explicit instruction (see rule 14).
- ❌ Do not run destructive DB operations or edit already-merged migrations.
- ❌ Do not introduce new dependencies for trivial things, or swap core
  libraries (auth, ORM/query layer, styling) without being asked.
- ❌ Do not build SQL by string interpolation of user input.
- ❌ Do not log PII, tokens, or credentials.
- ❌ Do not make large sweeping refactors uninvited (see rule 11).
- ❌ Do not over-comment (see rule 13) or leave commented-out dead code.
- ❌ Do not disable type checks/lint rules or delete tests to get a green build.

---

## 11. How to work in small, safe increments

- **One concern per change.** Make the smallest change that fully accomplishes
  the current step. Land it, then move on.
- **Plan briefly, then execute.** For anything non-trivial, state the steps,
  confirm the approach if it's ambiguous, then implement.
- **Keep changes reviewable.** Prefer several small, coherent commits over one
  large one. Each commit should leave the repo in a working state.
- **Don't mix concerns.** Refactors, feature work, and formatting churn go in
  separate changes. Avoid reformatting files you aren't otherwise touching.
- **Verify as you go.** Run type checks, lint, and relevant tests before
  considering a step done. Report honestly what passed and what didn't.
- **Touch only what the task needs.** If you discover unrelated issues, note
  them rather than fixing them inline.

---

## 12. Conservative changes to storage / auth / security

Any change that touches **storage access, authentication, authorization, or a
security boundary** must be:

1. **Conservative** — the smallest change that meets the need; default to the
   more restrictive option when in doubt.
2. **Reversible** — easy to roll back; prefer additive/expand-contract over
   destructive.
3. **Clearly explained** — before (or alongside) the change, state in plain
   language: what is changing, why, what the new trust/access boundary is, and
   what could go wrong.
4. **Confirmed when impactful** — if it widens access, changes who can do what,
   alters token lifetimes/scopes, or affects existing data, pause and get
   explicit user sign-off before proceeding.

When unsure whether something counts as security-sensitive, assume it does.

---

## 13. Commenting policy

- **Comment the *why*, not the *what*.** Explain intent, trade-offs,
  non-obvious constraints, and anything surprising (e.g. "R2 requires the
  content-length header here or the presign is rejected").
- **Do not narrate obvious code.** No `// increment i` or comments that restate
  the line beneath them.
- Prefer self-explanatory names and small functions over explanatory comments.
- Document public/shared functions with a short doc comment where it genuinely
  aids a caller; skip it for trivial internal helpers.
- No commented-out code in commits. No banner/decoration comment blocks.

The goal: a reader skims the code and the few comments that exist all earn
their place.

---

## 14. Prefer a simple monolithic architecture

Default to the simplest thing that works: **one Next.js app plus the one
background worker.** Do not introduce additional services, separate APIs,
message brokers, serverless function sprawl, multiple repos, or other
distributed-system machinery unless the user explicitly asks for it.

If you believe added architecture is warranted, **propose it and wait for
approval** — explain the concrete problem it solves and the cost it adds.
Simplicity is the default; complexity must be justified and requested.

---

## Quick reference for common tasks

- **Adding an endpoint**: validate input → check session/ownership → call a
  `lib/` service → return the standard shape. Add tests.
- **Adding a media feature**: presign in `lib/storage`, record in `lib/db`,
  enqueue worker job, handle idempotently in `worker/`.
- **Changing schema**: new file in `migrations/`, expand/contract, explain
  risk, get sign-off if destructive.
- **Touching auth/storage/security**: apply rule 12.

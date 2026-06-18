---
name: create-migration
description: >-
  Create a new ordered SQL migration for CandidVault following the project's
  DB conventions: append-only and immutable once merged, expand/contract for
  risky changes, and explicit flagging + sign-off for destructive operations.
  Use whenever adding or changing PostgreSQL schema.
---

# Create a database migration

Follow CLAUDE.md §6 (DB migration conventions) and §12 (conservative changes).

## Steps

1. **Find the next sequence number.** Look at `migrations/` and pick the next
   zero-padded prefix (e.g. if the latest is `0006_*.sql`, use `0007_`).
2. **Name it for intent**: `0007_add_media_status.sql`.
3. **Write an intent header comment** stating what changes and why.
4. **Prefer expand/contract** for anything risky:
   - Add new columns nullable or with a default first.
   - Backfill in a separate step.
   - Switch the application to the new shape.
   - Remove the old shape in a *later* migration.
5. **Flag destructive operations.** `DROP`, `DELETE`, type narrowing, or
   `NOT NULL` on populated columns require an explicit explanation in the PR
   and user sign-off before running. Do not bundle them with additive changes.
6. **Indexes**: name predictably and comment the query they serve.
7. **Never edit an already-merged migration** — fix mistakes with a new one.

## Template

```sql
-- 0007_add_media_status.sql
-- Intent: track async processing state per media asset so the worker can
-- run idempotently and the UI can show processing status.
-- Risk: additive only (new nullable column + index). No backfill required.

ALTER TABLE media_assets
  ADD COLUMN status text NOT NULL DEFAULT 'pending';

CREATE INDEX idx_media_assets_status
  ON media_assets (status);  -- serves the worker's "fetch pending jobs" query
```

## Before finishing

- Confirm the migration is reviewable in isolation.
- If anything locks a large table, rewrites rows, or drops data, say so
  explicitly and get sign-off.

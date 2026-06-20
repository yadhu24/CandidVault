# CandidVault

QR-based guest photo & video collection platform for events. Built for
photographers to collect, moderate and export guest memories.

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · PostgreSQL · Supabase Auth ·
Cloudflare R2 · a background worker (thumbnails, metadata extraction, ZIP export).

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

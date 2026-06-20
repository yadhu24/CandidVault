# .claude/skills — CandidVault

This directory holds **project skills**: reusable, scoped instructions that
Claude can invoke on demand for recurring CandidVault tasks. Skills keep
`CLAUDE.md` lean (it stays high-level and always-on) while letting detailed,
task-specific playbooks live close to the work and load only when needed.

## How skills work

Each skill is a directory containing a `SKILL.md` file with YAML frontmatter:

```
.claude/skills/
├── README.md                  # this file
├── add-api-endpoint/
│   └── SKILL.md
├── create-migration/
│   └── SKILL.md
├── add-worker-job/
│   └── SKILL.md
└── presign-upload-flow/
    └── SKILL.md
```

`SKILL.md` frontmatter:

```markdown
---
name: create-migration
description: >-
  Create a new ordered SQL migration following CandidVault conventions
  (expand/contract, immutable once merged, destructive ops flagged). Use
  when adding or changing database schema.
---

# Body: step-by-step instructions, conventions to follow, and examples.
```

- **`name`** must match the directory name (kebab-case).
- **`description`** is what Claude matches against — make it specific about
  *what* the skill does and *when* to use it.
- The body holds the actual procedure: steps, conventions, gotchas, snippets.
- Supporting files (templates, scripts, examples) can live alongside `SKILL.md`
  in the same directory and be referenced from the body.

## Recommended skills to add as the project grows

| Skill                 | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `add-api-endpoint`    | Scaffold a route handler with validation, auth, standard shape |
| `create-migration`    | Author a safe, ordered, expand/contract SQL migration          |
| `add-worker-job`      | Add an idempotent background job + status tracking             |
| `presign-upload-flow` | Wire a guest upload: presign → upload → confirm → enqueue      |
| `add-ui-component`    | Create a component matching naming + Tailwind conventions      |
| `security-change`     | Checklist for conservative auth/storage/security changes       |

## Conventions for authoring skills here

- One skill = one clearly-scoped task. Keep them focused.
- Skills must **defer to `CLAUDE.md`** — they add procedure, never contradict
  the binding rules (security, migrations, simplicity, commenting).
- Keep skills short and imperative. Link to code locations rather than
  duplicating large code blocks.
- Update a skill when the underlying convention changes; treat skills as
  living documentation.

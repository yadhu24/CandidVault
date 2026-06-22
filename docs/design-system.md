# CandidVault Design System

The single source of truth for how CandidVault looks and feels. Build every new
screen from these tokens and components so the product stays consistent and
re-themes from one place.

- **Tokens** live in [`app/globals.css`](../app/globals.css) (Tailwind v4 `@theme`).
- **Components** live in [`components/ui/`](../components/ui) — import from `@/components/ui`.
- **Living reference**: run the app and open [`/design-system`](../app/design-system/page.tsx)
  to see every token and component in light **and** dark (toggle, top-right).

---

## 1. Design direction

Warm, celebratory, premium, trustworthy — for Indian weddings & events, without
the kitsch. Restrained and confident, with generous whitespace.

- **Guest upload** is the most important surface: flawless on a phone,
  one-handed, on a patchy venue network. Mobile-first, large tap targets.
- **Photographer dashboard**: clean and efficient on desktop and mobile.

---

## 2. Color

Defined as ramps **and** semantic tokens. **Always use the semantic tokens**
(`bg-primary`, `text-foreground`, `bg-card`, `border-border`,
`text-muted-foreground`, the `*-subtle` status families). Never hardcode hex or
the old `zinc-*` classes — semantic tokens flip automatically in dark mode.

| Role | Ramp | Notes |
| --- | --- | --- |
| Primary — rose ("rani") | `primary-50…950` | Celebratory, premium. Primary actions. |
| Accent — gold ("haldi") | `gold-50…950` | Premium highlights, used sparingly. |
| Neutral — sand | `sand-50…950` | Warm (not cold gray); backbone of surfaces & text. |

**Semantic tokens** (light/dark values set in `:root` / `.dark`):

`background`, `foreground`, `card`(+`-foreground`), `popover`(+`-foreground`),
`primary`(+`-foreground`), `secondary`(+`-foreground`), `muted`(+`-foreground`),
`accent`(+`-foreground`), `border`, `input`, `ring`, `overlay`.

**Status families** — each has solid + `-subtle` background + `-subtle-foreground`
+ `-border`, for both filled and quiet treatments:

| Status | Use |
| --- | --- |
| `success` | approved / ready |
| `warning` | pending |
| `destructive` | rejected / error / destructive actions |
| `info` | processing / neutral info |

Example pill: `bg-success-subtle text-success-subtle-foreground border-success-border`.

### Contrast (WCAG AA)
Body/foreground pairs, muted text, primary/white, and status text all target
≥ 4.5:1. Color is never the only signal — status pills always carry a text label.

---

## 3. Typography

- **UI / body**: Geist Sans (`font-sans`, the default).
- **Display / headings**: Fraunces serif — apply `font-display`.
- **Mono**: Geist Mono (`font-mono`) for URLs, tokens, code.

Named scale (size + line-height + tracking + weight baked in):

| Utility | Use |
| --- | --- |
| `text-display` / `text-display-lg` | Hero/marketing (pair with `font-display`) |
| `text-title` | Large page hero |
| `text-h1` `text-h2` `text-h3` | Headings (h1/h2 often `font-display`) |
| `text-body-lg` `text-body` `text-body-sm` | Reading text → dense UI |
| `text-caption` | Metadata, helper text, timestamps |
| `text-overline` | Uppercase eyebrow labels |

Responsive display: e.g. `text-h1 md:text-display`.

---

## 4. Spacing, radius, elevation, motion

- **Spacing**: Tailwind's default 0.25rem scale. Favor a rhythm of
  `2 / 3 / 4 / 6 / 8 / 12 / 16`; cards use `px-6 py-4`, page sections `space-y-16`.
- **Radius**: `rounded-sm` (6) · `rounded-md` (8, controls) · `rounded-lg` (12) ·
  `rounded-xl` (16, cards) · `rounded-2xl` (24, dropzone/sheets) · `rounded-3xl`.
- **Shadows**: warm-tinted, soft — `shadow-xs` → `shadow-xl`. Buttons/cards use
  `shadow-xs`; overlays use `shadow-xl`.
- **Motion**: `animate-spin` (Spinner), `animate-shimmer` (Skeleton),
  `animate-pulse`. All decorative motion is disabled under
  `prefers-reduced-motion` via a global rule.

---

## 5. Dark mode

Class-based: add `dark` to `<html>` (or any ancestor). All semantic utilities
respond automatically. For one-off shade choices, use `dark:` variants
(e.g. `text-primary-700 dark:text-primary-300` for link text). There is no
persisted theme switcher yet — wire one to toggle the `dark` class when needed.

---

## 6. Components (`@/components/ui`)

| Component | Purpose / key props |
| --- | --- |
| `Button` | `variant` primary·secondary·ghost·outline·destructive; `size` sm·md·lg·icon; `isLoading`. md/lg/icon ≥ 44px. |
| `Input` | `label`, `error` (wires `aria-invalid`/`aria-describedby`); 44px tall. |
| `Card` + `CardHeader/Content/Footer` | Surface container. |
| `Badge` | `variant` default·success·warning·error·info·accent. |
| `StatusPill` | `status` pending·approved·rejected·processing·ready·failed; dot + label. |
| `Modal` | `open`, `onClose`, `title`; Esc/overlay close, focus trap-in, scroll lock. |
| `Drawer` | `open`, `onClose`, `title`, `side` right·bottom, `footer`; `inert` when closed. |
| `Dropzone` | `onFiles`, `accept`, `multiple`, `capture` (mobile camera), `hint`. Drag + tap; visible focus. |
| `UploadProgressItem` | `name`, `status`, `progress`, `error`, `onRetry`, `onRemove`; accessible progressbar. |
| `MediaTile` | `src`, `alt`, `type` photo·video, `durationLabel`, `status`, `href`/`onClick`, `selected`/`onToggleSelect`. |
| `MediaGrid` | Responsive 2→5 column gallery grid. |
| `EmptyState` | `icon`, `title`, `description`, `action`. |
| `Spinner` / `Skeleton` | Loading states (reduced-motion aware). |
| `icons` | Inline SVG set (no icon-library dependency). |

---

## 7. Accessibility checklist (every screen)

- AA contrast (≥ 4.5:1 text); never rely on color alone.
- Interactive touch targets ≥ 44px (use Button `md`/`lg`/`icon`, `Input`).
- Visible `focus-visible` rings (`ring-ring`) on all interactive elements.
- Icon-only controls have an `aria-label`; decorative icons stay `aria-hidden`.
- Dialogs/drawers: labelled, Escape to close, focus moves in and restores out.

---

## 8. Extending the system

1. Add or adjust **tokens** in `app/globals.css` (ramp in `@theme`, semantic
   value in `:root` **and** `.dark`, mapped under `@theme inline`).
2. Build new primitives in `components/ui/`, consuming semantic tokens only, and
   export them from `components/ui/index.ts`.
3. Add an example to `app/design-system/page.tsx`.
4. Keep `StatusPill`/`Badge` tone maps as full literal class strings (Tailwind's
   scanner can't see interpolated class names).

'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Drawer,
  Dropzone,
  EmptyState,
  Input,
  MediaGrid,
  MediaTile,
  Modal,
  Skeleton,
  Spinner,
  StatusPill,
  UploadProgressItem,
} from '@/components/ui'
import { CameraIcon, DownloadIcon, InboxIcon, MoonIcon, PlusIcon, SunIcon } from '@/components/ui/icons'

// Internal living reference for the CandidVault design system. Every token and
// component is rendered here against light/dark so screens stay consistent.

function tile(from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Full literal class names (Tailwind's scanner can't see interpolated ones).
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
// Read the active theme from the DOM without setState-in-effect (the toggle just
// flips the `dark` class on <html>; this re-renders via the class observer).
function useIsDark() {
  return useSyncExternalStore(
    (onChange) => {
      const obs = new MutationObserver(onChange)
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => obs.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

const PRIMARY_RAMP = ['bg-primary-50', 'bg-primary-100', 'bg-primary-200', 'bg-primary-300', 'bg-primary-400', 'bg-primary-500', 'bg-primary-600', 'bg-primary-700', 'bg-primary-800', 'bg-primary-900', 'bg-primary-950']
const GOLD_RAMP = ['bg-gold-50', 'bg-gold-100', 'bg-gold-200', 'bg-gold-300', 'bg-gold-400', 'bg-gold-500', 'bg-gold-600', 'bg-gold-700', 'bg-gold-800', 'bg-gold-900', 'bg-gold-950']
const SAND_RAMP = ['bg-sand-50', 'bg-sand-100', 'bg-sand-200', 'bg-sand-300', 'bg-sand-400', 'bg-sand-500', 'bg-sand-600', 'bg-sand-700', 'bg-sand-800', 'bg-sand-900', 'bg-sand-950']

export default function DesignSystemPage() {
  const dark = useIsDark()
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [picked, setPicked] = useState<number>(0)
  const [selected, setSelected] = useState<Record<number, boolean>>({ 1: true })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-overline uppercase text-primary">CandidVault</p>
            <h1 className="font-display text-h1 text-foreground">Design System</h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => document.documentElement.classList.toggle('dark')}
            aria-label="Toggle dark mode"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">
        {/* Colors ----------------------------------------------------------- */}
        <Section title="Color" description="Warm rose primary, champagne gold accent, warm sand neutrals, semantic states. Components use semantic tokens so light/dark flips automatically.">
          <h3 className="mb-2 text-h3">Primary — rose</h3>
          <div className="mb-6 grid grid-cols-6 gap-2 sm:grid-cols-11">
            {PRIMARY_RAMP.map((c, i) => (
              <Swatch key={c} className={c} label={`${STEPS[i]}`} />
            ))}
          </div>
          <h3 className="mb-2 text-h3">Accent — gold</h3>
          <div className="mb-6 grid grid-cols-6 gap-2 sm:grid-cols-11">
            {GOLD_RAMP.map((c, i) => (
              <Swatch key={c} className={c} label={`${STEPS[i]}`} />
            ))}
          </div>
          <h3 className="mb-2 text-h3">Neutral — sand</h3>
          <div className="mb-6 grid grid-cols-6 gap-2 sm:grid-cols-11">
            {SAND_RAMP.map((c, i) => (
              <Swatch key={c} className={c} label={`${STEPS[i]}`} />
            ))}
          </div>
          <h3 className="mb-2 text-h3">Semantic</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <TokenSwatch className="bg-background border border-border" label="background" />
            <TokenSwatch className="bg-card border border-border" label="card" />
            <TokenSwatch className="bg-muted" label="muted" />
            <TokenSwatch className="bg-primary" label="primary" dark />
            <TokenSwatch className="bg-secondary" label="secondary" />
            <TokenSwatch className="bg-accent" label="accent" />
            <TokenSwatch className="bg-success" label="success" dark />
            <TokenSwatch className="bg-warning" label="warning" dark />
            <TokenSwatch className="bg-destructive" label="destructive" dark />
            <TokenSwatch className="bg-info" label="info" dark />
            <TokenSwatch className="bg-success-subtle border border-success-border" label="success-subtle" />
            <TokenSwatch className="bg-destructive-subtle border border-destructive-border" label="destructive-subtle" />
          </div>
        </Section>

        {/* Typography ------------------------------------------------------- */}
        <Section title="Typography" description="Geist for UI, Fraunces (serif) for display & headings. Pair display/title/headings with `font-display`.">
          <div className="space-y-3">
            <p className="font-display text-display text-foreground">Every candid moment</p>
            <p className="font-display text-title text-foreground">Collected beautifully</p>
            <p className="font-display text-h1 text-foreground">Heading 1 — section title</p>
            <p className="text-h2 text-foreground">Heading 2 — card title</p>
            <p className="text-h3 text-foreground">Heading 3 — group label</p>
            <p className="text-body-lg text-foreground">Body large — lead paragraph for intros and empty states.</p>
            <p className="text-body text-foreground">Body — the default reading size for content and forms.</p>
            <p className="text-body-sm text-muted-foreground">Body small — secondary text and dense UI.</p>
            <p className="text-caption text-muted-foreground">Caption — metadata, timestamps, helper text.</p>
            <p className="text-overline uppercase text-muted-foreground">Overline — eyebrow labels</p>
          </div>
        </Section>

        {/* Radius & shadow -------------------------------------------------- */}
        <Section title="Radius & elevation">
          <div className="mb-6 flex flex-wrap gap-4">
            {['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl'].map((r) => (
              <div key={r} className="text-center">
                <div className={`size-20 border border-border bg-card ${r}`} />
                <p className="mt-1 text-caption text-muted-foreground">{r.replace('rounded-', '')}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl'].map((s) => (
              <div key={s} className="text-center">
                <div className={`size-20 rounded-xl bg-card ${s}`} />
                <p className="mt-1 text-caption text-muted-foreground">{s.replace('shadow-', '')}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons ---------------------------------------------------------- */}
        <Section title="Buttons" description="md / lg / icon meet the 44px touch target. sm is for dense desktop.">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              <PlusIcon />
            </Button>
            <Button isLoading>Saving…</Button>
            <Button disabled>Disabled</Button>
            <Button variant="primary">
              <DownloadIcon className="size-4" /> Export ZIP
            </Button>
          </div>
        </Section>

        {/* Inputs ----------------------------------------------------------- */}
        <Section title="Inputs">
          <div className="grid max-w-xl gap-4">
            <Input label="Your name" placeholder="So the photographer knows who shared" />
            <Input label="Email" type="email" placeholder="you@example.com" />
            <Input label="Event name" defaultValue="Aarav & Meera" error="This name is already taken" />
            <Input label="Disabled" placeholder="Unavailable" disabled />
          </div>
        </Section>

        {/* Status & badges -------------------------------------------------- */}
        <Section title="Status pills & badges" description="Color is never the only signal — every pill has a label (and dot).">
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusPill status="pending" />
            <StatusPill status="approved" />
            <StatusPill status="rejected" />
            <StatusPill status="processing" />
            <StatusPill status="ready" />
            <StatusPill status="failed" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="accent">Accent</Badge>
          </div>
        </Section>

        {/* Cards ------------------------------------------------------------ */}
        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-h3">Aarav & Meera</h3>
              </CardHeader>
              <CardContent className="space-y-1 text-body-sm text-muted-foreground">
                <p>Wedding · 14 Feb 2026</p>
                <p>The Leela Palace, Udaipur</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <StatusPill status="approved" />
                <Button size="sm" variant="ghost">
                  Manage
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardContent className="space-y-3">
                <p className="text-overline uppercase text-primary">Premium</p>
                <p className="font-display text-h2">Handed over with trust</p>
                <p className="text-body-sm text-muted-foreground">
                  Guests upload their candid memories in seconds — no app, no login.
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Overlays --------------------------------------------------------- */}
        <Section title="Modal & Drawer">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="outline" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
          </div>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Close this event?">
            <p className="text-body-sm text-muted-foreground">
              Guests will no longer be able to upload. You can reopen it at any time.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setModalOpen(false)}>
                Close event
              </Button>
            </div>
          </Modal>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Upload details"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Close
                </Button>
                <Button>Approve</Button>
              </div>
            }
          >
            <div className="space-y-3 text-body-sm text-muted-foreground">
              <p>Uploaded by Priya · 2 minutes ago</p>
              <p>4032 × 3024 · 6.2 MB · JPEG</p>
              <StatusPill status="pending" />
            </div>
          </Drawer>
        </Section>

        {/* Upload ----------------------------------------------------------- */}
        <Section title="Upload — dropzone & progress" description="The most important surface: flawless on a phone, one-handed.">
          <div className="grid gap-6 lg:grid-cols-2">
            <Dropzone
              onFiles={(f) => setPicked(f.length)}
              accept="image/*,video/*"
              capture="environment"
              hint={picked ? `${picked} file(s) selected` : 'JPEG, PNG, HEIC, WebP, MP4 or MOV'}
            />
            <div className="space-y-2">
              <UploadProgressItem name="IMG_4821.jpg" status="uploading" progress={62} />
              <UploadProgressItem name="ceremony-clip.mov" status="finalizing" progress={100} />
              <UploadProgressItem name="DSC_0093.jpg" status="done" />
              <UploadProgressItem
                name="huge-raw.dng"
                status="error"
                error="File is too large"
                onRetry={() => {}}
                onRemove={() => {}}
              />
            </div>
          </div>
        </Section>

        {/* Media grid ------------------------------------------------------- */}
        <Section title="Media tiles & grid">
          <MediaGrid>
            {[
              ['#e36e8a', '#b53a57'],
              ['#d0a53d', '#9a6e22'],
              ['#b5a892', '#564e43'],
              ['#ef9fb2', '#d24c6b'],
              ['#ddbe63', '#7b561f'],
            ].map(([a, b], i) => (
              <MediaTile
                key={i}
                src={tile(a, b)}
                alt={`Sample media ${i + 1}`}
                type={i % 3 === 0 ? 'video' : 'photo'}
                durationLabel={i % 3 === 0 ? '0:42' : undefined}
                status={i === 2 ? 'pending' : undefined}
                selected={Boolean(selected[i])}
                onToggleSelect={() => setSelected((s) => ({ ...s, [i]: !s[i] }))}
                onClick={() => {}}
              />
            ))}
          </MediaGrid>
        </Section>

        {/* Empty & loading -------------------------------------------------- */}
        <Section title="Empty & loading states">
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              icon={<InboxIcon className="size-6" />}
              title="No uploads yet"
              description="Share your QR code and guest photos will appear here as they arrive."
              action={
                <Button>
                  <CameraIcon className="size-4" /> Share QR code
                </Button>
              }
            />
            <div>
              <div className="mb-3 flex items-center gap-2 text-body-sm text-muted-foreground">
                <Spinner /> Loading gallery…
              </div>
              <MediaGrid>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </MediaGrid>
            </div>
          </div>
        </Section>
      </main>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-5 border-b border-border pb-3">
        <h2 className="font-display text-h1 text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div>
      <div className={`h-12 rounded-md border border-border/50 ${className}`} />
      <p className="mt-1 text-center text-caption text-muted-foreground">{label}</p>
    </div>
  )
}

function TokenSwatch({ className, label, dark }: { className: string; label: string; dark?: boolean }) {
  return (
    <div>
      <div className={`flex h-16 items-end rounded-lg p-2 ${className}`}>
        <span className={`text-caption font-medium ${dark ? 'text-white/90' : 'text-foreground/70'}`}>Aa</span>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">{label}</p>
    </div>
  )
}

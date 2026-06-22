import type { ReactNode } from 'react'
import { formatEventDate } from '@/lib/events/format'
import { resolvePublicEvent } from '@/lib/events/service'
import { AlertIcon, CalendarIcon, MapPinIcon } from '@/components/ui/icons'
import { GuestUploader } from './GuestUploader'

interface Props {
  params: Promise<{ slug: string }>
}

const INACTIVE_MESSAGE: Record<string, string> = {
  not_published: 'This event isn’t open for uploads yet. Please check back soon.',
  closed: 'This event has closed and is no longer accepting uploads.',
  revoked: 'This upload link has been deactivated by the photographer.',
}

export default async function GuestUploadPage({ params }: Props) {
  const { slug } = await params
  const result = await resolvePublicEvent(slug)

  if (result.state === 'not_found') {
    return (
      <PublicShell>
        <StateCard
          tone="destructive"
          icon={<AlertIcon className="size-8" />}
          title="This link doesn’t look right"
          message="Double-check the QR code, or ask the host for a fresh link to share your photos."
        />
      </PublicShell>
    )
  }

  if (result.state === 'inactive') {
    return (
      <PublicShell>
        <StateCard
          tone="muted"
          icon={<CalendarIcon className="size-8" />}
          title={result.event.name}
          message={INACTIVE_MESSAGE[result.reason]}
        />
      </PublicShell>
    )
  }

  const { event } = result
  return (
    <PublicShell>
      <header className="text-center">
        <p className="text-overline uppercase text-primary">You’re invited to share</p>
        <h1 className="mt-1 font-display text-title text-foreground">{event.name}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3.5" /> {formatEventDate(event.eventDate)}
          </span>
          {event.venue && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3.5" /> {event.venue}
            </span>
          )}
        </div>
      </header>
      <GuestUploader slug={event.slug} eventName={event.name} />
    </PublicShell>
  )
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-5 py-8">
      <div className="mb-8 font-display text-h3 text-foreground">CandidVault</div>
      <div className="w-full max-w-md space-y-8">{children}</div>
      <p className="mt-12 text-caption text-muted-foreground">Powered by CandidVault</p>
    </main>
  )
}

function StateCard({
  tone,
  icon,
  title,
  message,
}: {
  tone: 'muted' | 'destructive'
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-xs">
      <div
        className={
          'mx-auto flex size-16 items-center justify-center rounded-full ' +
          (tone === 'destructive'
            ? 'bg-destructive-subtle text-destructive-subtle-foreground'
            : 'bg-muted text-muted-foreground')
        }
      >
        {icon}
      </div>
      <h1 className="mt-5 font-display text-h2 text-foreground">{title}</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">{message}</p>
    </div>
  )
}

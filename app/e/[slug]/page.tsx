import { formatEventDate } from '@/lib/events/format'
import { resolvePublicEvent } from '@/lib/events/service'

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
          title="Link not found"
          message="This upload link is invalid or has been removed."
        />
      </PublicShell>
    )
  }

  if (result.state === 'inactive') {
    return (
      <PublicShell>
        <StateCard title={result.event.name} message={INACTIVE_MESSAGE[result.reason]} />
      </PublicShell>
    )
  }

  const { event } = result
  return (
    <PublicShell>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">{event.name}</h1>
        <p className="text-sm text-zinc-500">
          {formatEventDate(event.eventDate)}
          {event.venue ? ` · ${event.venue}` : ''}
        </p>
      </div>
      <UploadShell />
    </PublicShell>
  )
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-10">
      <div className="mb-8 text-sm font-semibold text-zinc-900">CandidVault</div>
      <div className="w-full max-w-md space-y-6">{children}</div>
      <p className="mt-10 text-xs text-zinc-400">Powered by CandidVault</p>
    </main>
  )
}

function StateCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center">
      <h1 className="font-semibold text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  )
}

// Placeholder shell only — the real uploader (presign + direct-to-R2) lands in a
// later task.
function UploadShell() {
  return (
    <div className="rounded-lg border-2 border-dashed border-zinc-300 bg-white p-8 text-center">
      <h2 className="font-semibold text-zinc-900">Share your photos &amp; videos</h2>
      <p className="mt-1 text-sm text-zinc-500">Help capture every moment of the event.</p>
      <button
        type="button"
        disabled
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white opacity-50"
      >
        Select files
      </button>
      <p className="mt-3 text-xs text-zinc-400">Uploading will be enabled here soon.</p>
    </div>
  )
}

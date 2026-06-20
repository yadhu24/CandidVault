import Link from 'next/link'
import { EventCard } from '@/components/events/EventCard'
import { requirePhotographer } from '@/lib/account/photographers'
import { listEventsForPhotographer } from '@/lib/events/service'
import { cn } from '@/lib/utils'

const ctaClasses =
  'inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800'

export default async function DashboardPage() {
  const { user } = await requirePhotographer()
  const events = await listEventsForPhotographer(user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your events</h1>
          <p className="mt-1 text-sm text-zinc-500">Create and manage your event galleries.</p>
        </div>
        <Link href="/events/new" className={ctaClasses}>
          Create event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center">
          <h2 className="font-semibold text-zinc-900">No events yet</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Create your first event to get a shareable upload link.
          </p>
          <Link href="/events/new" className={cn(ctaClasses, 'mt-4')}>
            Create event
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

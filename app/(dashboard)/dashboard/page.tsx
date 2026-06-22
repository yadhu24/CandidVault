import Link from 'next/link'
import { EventCard } from '@/components/events/EventCard'
import { EmptyState } from '@/components/ui'
import { PlusIcon, SparkleIcon } from '@/components/ui/icons'
import { requirePhotographer } from '@/lib/account/photographers'
import { listEventsForPhotographer } from '@/lib/events/service'

// Styled link that reads as the primary button (a Link, not a <button>, so it
// navigates without nesting interactive elements).
const primaryLink =
  'inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-body-sm font-medium text-primary-foreground shadow-xs transition hover:brightness-95 active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export default async function DashboardPage() {
  const { user } = await requirePhotographer()
  const events = await listEventsForPhotographer(user.id)

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 text-foreground">Your events</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {events.length > 0
              ? `${events.length} ${events.length === 1 ? 'event' : 'events'}`
              : 'Create and manage your event galleries.'}
          </p>
        </div>
        <Link href="/events/new" className={primaryLink}>
          <PlusIcon className="size-5" /> Create event
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<SparkleIcon className="size-6" />}
          title="No events yet"
          description="Create an event, share its QR code, and your guests' photos will start landing here."
          action={
            <Link href="/events/new" className={primaryLink}>
              <PlusIcon className="size-5" /> Create your first event
            </Link>
          }
        />
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

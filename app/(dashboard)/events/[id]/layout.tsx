import Link from 'next/link'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { requirePhotographer } from '@/lib/account/photographers'
import { formatEventDate } from '@/lib/events/format'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { EVENT_TYPE_LABELS } from '@/lib/validation/events'
import { EventTabs } from './EventTabs'

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function EventDetailLayout({ children, params }: Props) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to events
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h1 text-foreground">{event.name}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="text-body-sm text-muted-foreground">
          {EVENT_TYPE_LABELS[event.eventType]} · {formatEventDate(event.eventDate)}
        </p>
      </div>

      <EventTabs eventId={event.id} />

      <div>{children}</div>
    </div>
  )
}

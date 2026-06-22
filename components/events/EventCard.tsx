import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { formatEventDate } from '@/lib/events/format'
import { EVENT_TYPE_LABELS } from '@/lib/validation/events'
import type { Event } from '@/types'
import { EventStatusBadge } from './EventStatusBadge'

export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:outline-none"
    >
      <Card className="h-full">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 font-semibold text-zinc-900">{event.name}</h3>
            <EventStatusBadge status={event.status} />
          </div>
          <dl className="space-y-1 text-sm text-zinc-500">
            <dd>{EVENT_TYPE_LABELS[event.eventType]}</dd>
            <dd>{formatEventDate(event.eventDate)}</dd>
            {event.venue && <dd className="truncate">{event.venue}</dd>}
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}

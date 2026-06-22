import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { CalendarIcon, MapPinIcon } from '@/components/ui/icons'
import { formatEventDate } from '@/lib/events/format'
import { EVENT_TYPE_LABELS } from '@/lib/validation/events'
import type { Event } from '@/types'
import { EventStatusBadge } from './EventStatusBadge'

export function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 font-display text-h3 text-foreground">{event.name}</h2>
            <EventStatusBadge status={event.status} />
          </div>
          <dl className="space-y-1.5 text-caption text-muted-foreground">
            <dd className="text-overline uppercase">{EVENT_TYPE_LABELS[event.eventType]}</dd>
            <dd className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" /> {formatEventDate(event.eventDate)}
            </dd>
            {event.venue && (
              <dd className="flex items-center gap-1.5">
                <MapPinIcon className="size-3.5 shrink-0" />
                <span className="truncate">{event.venue}</span>
              </dd>
            )}
          </dl>
        </CardContent>
      </Card>
    </Link>
  )
}

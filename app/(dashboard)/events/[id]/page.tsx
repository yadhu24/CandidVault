import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { requirePhotographer } from '@/lib/account/photographers'
import { formatEventDate } from '@/lib/events/format'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { EVENT_TYPE_LABELS } from '@/lib/validation/events'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventOverviewPage({ params }: Props) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const shareUrl = `${appUrl}/e/${event.slug}`

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <h2 className="font-semibold">Event details</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Detail label="Title" value={event.name} />
            <Detail label="Type" value={EVENT_TYPE_LABELS[event.eventType]} />
            <Detail label="Date" value={formatEventDate(event.eventDate)} />
            <Detail label="Venue" value={event.venue ?? '—'} />
            <Detail label="Status" value={event.status} className="capitalize" />
          </dl>
          {event.description && <p className="mt-6 text-sm text-zinc-600">{event.description}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Guest upload link</h2>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-zinc-500">Share this link (or its QR code) with guests.</p>
          <code className="block rounded bg-zinc-100 px-2 py-1 text-xs break-all">{shareUrl}</code>
          <p className="text-xs text-zinc-400">QR generation arrives with the uploads feature.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <dt className="text-zinc-400">{label}</dt>
      <dd className={cn('mt-0.5 text-zinc-900', className)}>{value}</dd>
    </div>
  )
}

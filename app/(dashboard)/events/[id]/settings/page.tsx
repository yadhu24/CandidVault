import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { requirePhotographer } from '@/lib/account/photographers'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { EventSettingsForm } from './EventSettingsForm'
import { DangerZone } from './DangerZone'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventSettingsPage({ params }: Props) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id) // ownership; notFound otherwise

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-display text-h3 text-foreground">Event details</h2>
        </CardHeader>
        <CardContent>
          <EventSettingsForm event={event} />
        </CardContent>
      </Card>

      <Card className="border-destructive-border">
        <CardHeader className="border-destructive-border">
          <h2 className="font-display text-h3 text-destructive">Danger zone</h2>
        </CardHeader>
        <CardContent>
          <DangerZone eventId={event.id} eventName={event.name} />
        </CardContent>
      </Card>
    </div>
  )
}

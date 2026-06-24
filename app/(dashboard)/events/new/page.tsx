import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { CreateEventForm } from './CreateEventForm'

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to events
        </Link>
        <h1 className="mt-2 font-display text-h1 text-foreground">Create event</h1>
      </div>
      <Card>
        <CardContent>
          <CreateEventForm />
        </CardContent>
      </Card>
    </div>
  )
}

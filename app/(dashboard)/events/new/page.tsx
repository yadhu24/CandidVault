import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { CreateEventForm } from './CreateEventForm'

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Back to events
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Create event</h1>
      </div>
      <Card>
        <CardContent>
          <CreateEventForm />
        </CardContent>
      </Card>
    </div>
  )
}

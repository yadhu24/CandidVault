'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge, Button, Card, CardContent, EmptyState } from '@/components/ui'
import { CalendarIcon, MapPinIcon, PlusIcon, SparkleIcon } from '@/components/ui/icons'
import { EVENTS, type MockEvent } from '../mock'
import { ProtoBar } from '../ProtoBar'

const STATUS: Record<MockEvent['status'], { variant: 'success' | 'warning' | 'default'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  draft: { variant: 'warning', label: 'Draft' },
  closed: { variant: 'default', label: 'Closed' },
}

export default function DashboardPrototype() {
  const [empty, setEmpty] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <ProtoBar title="Photographer dashboard">
        <Button size="sm" variant="ghost" onClick={() => setEmpty((e) => !e)}>
          {empty ? 'Show events' : 'Preview empty'}
        </Button>
      </ProtoBar>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1 text-foreground">Your events</h1>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {empty ? 'Create your first event to get started.' : `${EVENTS.length} events`}
            </p>
          </div>
          <Button>
            <PlusIcon className="size-5" /> Create event
          </Button>
        </div>

        {empty ? (
          <div className="mt-10">
            <EmptyState
              icon={<SparkleIcon className="size-6" />}
              title="No events yet"
              description="Create an event, share its QR code, and your guests' photos will start landing here."
              action={
                <Button>
                  <PlusIcon className="size-5" /> Create your first event
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EVENTS.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EventCard({ event }: { event: MockEvent }) {
  const status = STATUS[event.status]
  return (
    <Link
      href="/prototype/event"
      className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-h3 text-foreground">{event.name}</h2>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <dl className="space-y-1 text-caption text-muted-foreground">
            <dd className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" /> {event.date}
            </dd>
            <dd className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5" /> {event.venue}
            </dd>
          </dl>
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <Stat label="Scans" value={event.scans} />
            <Stat label="Uploads" value={event.uploads} />
            <Stat label="Approved" value={event.approved} />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-h3 tabular-nums text-foreground">{value}</p>
      <p className="text-overline uppercase text-muted-foreground">{label}</p>
    </div>
  )
}

'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { publishEventAction } from '@/lib/events/actions'
import type { EventStatus } from '@/types'

// Shown across an event's tabs whenever it isn't Active, so a photographer never
// silently shares a QR that can't receive uploads. Draft gets a one-click publish;
// Closed points to Settings to reopen.
export function EventStatusBanner({ eventId, status }: { eventId: string; status: EventStatus }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (status === 'active') return null
  const isDraft = status === 'draft'

  function publish() {
    startTransition(async () => {
      const res = await publishEventAction(eventId)
      if (res.ok) router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-border bg-warning-subtle px-4 py-3 text-warning-subtle-foreground">
      <div className="min-w-0">
        <p className="text-body-sm font-medium">
          {isDraft
            ? 'This event is in Draft — guests can’t upload yet.'
            : 'This event is Closed — it’s not accepting uploads.'}
        </p>
        <p className="text-caption">
          {isDraft
            ? 'Publish it to open the QR link and start collecting photos.'
            : 'Reopen it from Settings to collect more.'}
        </p>
      </div>
      <div className="shrink-0">
        {isDraft ? (
          <Button size="sm" onClick={publish} isLoading={pending}>
            {pending ? 'Publishing…' : 'Publish now'}
          </Button>
        ) : (
          <Link
            href={`/events/${eventId}/settings`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-3 text-body-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Open Settings
          </Link>
        )}
      </div>
    </div>
  )
}

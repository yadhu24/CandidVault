'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createEventAction } from '@/lib/events/actions'
import type { CreateEventState } from '@/lib/events/types'
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/validation/events'
import { cn } from '@/lib/utils'

const initialState: CreateEventState = {}

const fieldClass =
  'w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900'

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initialState)
  const fe = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      <Input
        id="name"
        name="name"
        label="Event title"
        placeholder="e.g. Priya &amp; Sam's Wedding"
        required
        maxLength={120}
        error={fe.name}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="eventType" className="text-sm font-medium text-zinc-700">
          Event type
        </label>
        <select
          id="eventType"
          name="eventType"
          defaultValue="wedding"
          className={cn('h-10', fieldClass, fe.eventType && 'border-red-500')}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {fe.eventType && <p className="text-xs text-red-500">{fe.eventType}</p>}
      </div>

      <Input
        id="eventDate"
        name="eventDate"
        type="date"
        label="Event date"
        required
        error={fe.eventDate}
      />

      <Input
        id="venue"
        name="venue"
        label="Venue (optional)"
        placeholder="e.g. The Grand Hall"
        maxLength={200}
        error={fe.venue}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-zinc-700">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className={cn('py-2', fieldClass, fe.description && 'border-red-500')}
        />
        {fe.description && <p className="text-xs text-red-500">{fe.description}</p>}
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create event'}
        </Button>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900">
          Cancel
        </Link>
      </div>
    </form>
  )
}

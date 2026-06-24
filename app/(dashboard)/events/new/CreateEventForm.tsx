'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button, Field, fieldControlClassName, Input } from '@/components/ui'
import { createEventAction } from '@/lib/events/actions'
import type { CreateEventState } from '@/lib/events/types'
import { EVENT_TYPES, EVENT_TYPE_LABELS } from '@/lib/validation/events'
import { cn } from '@/lib/utils'

const initialState: CreateEventState = {}

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initialState)
  const fe = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <Input
        id="name"
        name="name"
        label="Event title"
        placeholder="e.g. Priya & Sam's Wedding"
        required
        maxLength={120}
        error={fe.name}
      />

      <Field id="eventType" label="Event type" error={fe.eventType}>
        <select
          id="eventType"
          name="eventType"
          defaultValue="wedding"
          className={cn('h-11', fieldControlClassName, fe.eventType && 'border-destructive')}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

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

      <Field id="description" label="Description (optional)" error={fe.description}>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          className={cn('py-2', fieldControlClassName, fe.description && 'border-destructive')}
        />
      </Field>

      {state.error && <p className="text-body-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={pending}>
          {pending ? 'Creating…' : 'Create event'}
        </Button>
        <Link
          href="/dashboard"
          className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

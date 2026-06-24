'use client'

import { useActionState } from 'react'
import { Button, Field, fieldControlClassName, Input } from '@/components/ui'
import { updateEventAction } from '@/lib/events/actions'
import type { UpdateEventState } from '@/lib/events/types'
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
} from '@/lib/validation/events'
import type { Event } from '@/types'
import { cn } from '@/lib/utils'

const initialState: UpdateEventState = {}

export function EventSettingsForm({ event }: { event: Event }) {
  const [state, formAction, pending] = useActionState(updateEventAction, initialState)
  const fe = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="eventId" value={event.id} />

      <Input
        id="name"
        name="name"
        label="Event title"
        defaultValue={event.name}
        required
        maxLength={120}
        error={fe.name}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="eventType" label="Event type" error={fe.eventType}>
          <select
            id="eventType"
            name="eventType"
            defaultValue={event.eventType}
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
          defaultValue={event.eventDate ?? ''}
          required
          error={fe.eventDate}
        />
      </div>

      <Input
        id="venue"
        name="venue"
        label="Venue (optional)"
        defaultValue={event.venue ?? ''}
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
          defaultValue={event.description ?? ''}
          className={cn('py-2', fieldControlClassName, fe.description && 'border-destructive')}
        />
      </Field>

      <Field id="status" label="Status" error={fe.status}>
        <select
          id="status"
          name="status"
          defaultValue={event.status}
          className={cn('h-11', fieldControlClassName, fe.status && 'border-destructive')}
        >
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EVENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>

      {state.error && <p className="text-body-sm text-destructive">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {state.ok && !pending && (
          <span className="text-body-sm text-success" role="status">
            Saved
          </span>
        )}
      </div>
    </form>
  )
}

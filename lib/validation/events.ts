import { z } from 'zod'
import type { EventType } from '@/types'

// Single source of truth for the event-type taxonomy. Mirrors the CHECK
// constraint in migrations/0002 — keep them in sync.
export const EVENT_TYPES = [
  'wedding',
  'engagement',
  'birthday',
  'corporate',
  'party',
  'other',
] as const

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: 'Wedding',
  engagement: 'Engagement',
  birthday: 'Birthday',
  corporate: 'Corporate',
  party: 'Party',
  other: 'Other',
}

export const CreateEventSchema = z.object({
  name: z.string().trim().min(1, 'Title is required').max(120),
  eventType: z.enum(EVENT_TYPES),
  // <input type="date"> submits YYYY-MM-DD; validate shape and real calendar date.
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date'),
  venue: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>

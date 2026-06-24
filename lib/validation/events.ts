import { z } from 'zod'
import type { EventStatus, EventType } from '@/types'

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

// Lifecycle states. Mirrors the CHECK constraint in migrations/0001. Only an
// `active` event accepts guest uploads (see resolvePublicEvent).
export const EVENT_STATUSES = ['draft', 'active', 'closed'] as const

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft — hidden, not accepting uploads',
  active: 'Active — guests can upload',
  closed: 'Closed — no longer accepting uploads',
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

// Settings edit = the create fields plus the lifecycle status.
export const UpdateEventSchema = CreateEventSchema.extend({
  status: z.enum(EVENT_STATUSES),
})

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>

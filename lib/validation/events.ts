import { z } from 'zod'

export const CreateEventSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>

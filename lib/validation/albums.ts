import { z } from 'zod'

// Album fields. Name is required and bounded; description is optional. Centralized
// so the server action and any future API validate identically.
export const AlbumSchema = z.object({
  name: z.string().trim().min(1, 'Give the album a name.').max(120, 'That name is too long.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
})

export type AlbumInput = z.infer<typeof AlbumSchema>

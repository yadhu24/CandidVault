import { cache } from 'react'
import { requireAuth } from '@/lib/auth/guards'
import {
  ensurePhotographerProfile,
  ensureUser,
  getPhotographerProfile,
  getUserById,
} from '@/lib/db/queries/users'
import type { PhotographerContext } from './types'

// Creates the app-side user + (empty) photographer profile for a Supabase Auth
// identity. Idempotent, so it is safe to call on every authenticated request and
// regardless of which auth method (password, magic link) was used.
export async function bootstrapPhotographer(authUser: {
  id: string
  email: string
}): Promise<PhotographerContext> {
  const user = await ensureUser({ id: authUser.id, email: authUser.email })
  const profile = await ensurePhotographerProfile(user.id)
  return { user, profile }
}

// The dashboard entry point: gate on auth, then guarantee the photographer's
// rows exist and return them. cache() dedupes the work across the layout and the
// page within a single request. This is where "profile bootstrap after signup"
// actually lands — the first authenticated page load creates the rows.
export const requirePhotographer = cache(async (): Promise<PhotographerContext> => {
  const authUser = await requireAuth()
  const email = authUser.email
  if (!email) {
    // We only support email-based auth, so this should be unreachable.
    throw new Error('Authenticated user is missing an email address')
  }

  // Fetch the app user and their profile in parallel — both are keyed by the auth
  // id, so they don't depend on each other. Saves one round trip to a possibly
  // distant DB on every authenticated request.
  const [existing, existingProfile] = await Promise.all([
    getUserById(authUser.id),
    getPhotographerProfile(authUser.id),
  ])
  if (!existing) {
    return bootstrapPhotographer({ id: authUser.id, email })
  }

  const profile = existingProfile ?? (await ensurePhotographerProfile(existing.id))
  return { user: existing, profile }
})

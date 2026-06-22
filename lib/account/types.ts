import type { PhotographerProfile, User } from '@/types'

export interface PhotographerContext {
  user: User
  profile: PhotographerProfile
}

// Returned by the profile update server action; lives here (not in the
// 'use server' module, which may only export async functions).
export interface ProfileFormState {
  ok: boolean
  error?: string
}

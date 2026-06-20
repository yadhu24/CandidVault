import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './server'

// getUser() revalidates the JWT against Supabase on every call. cache() dedupes
// it within a single request so multiple guards/components don't re-hit it.
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

// For Server Components and layouts: redirect to /login when unauthenticated,
// otherwise return the verified Supabase user.
export async function requireAuth(): Promise<User> {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}

// For auth pages (login/signup): bounce already-signed-in users to the app.
export async function redirectIfAuthenticated(redirectTo = '/dashboard'): Promise<void> {
  const user = await getAuthUser()
  if (user) redirect(redirectTo)
}

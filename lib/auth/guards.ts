import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './server'

// For use in Server Components and layouts.
// Redirects to /login if no valid session; returns the authenticated user.
export async function requireAuth() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

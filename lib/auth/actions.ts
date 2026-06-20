'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from './server'

// Server-side sign out: clears the session cookies via the server client, then
// sends the user to the login page. Invoked from a <form action={...}> so it
// works without client JS.
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

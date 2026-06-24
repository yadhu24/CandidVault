import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-only. Never import into client components.

// For Server Components and Server Actions — session lives in cookies.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware handles the actual refresh.
          }
        },
      },
    },
  )
}

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/auth/server'

// Only allow same-origin, absolute internal paths — blocks open-redirect abuse
// via a crafted ?next=//evil.com or ?next=https://evil.com.
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard'
  return next
}

// Exchanges the one-time code from an email confirmation or magic link for a
// session cookie, then continues into the app. This is the redirect target set
// as `emailRedirectTo` on signUp / signInWithOtp.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}

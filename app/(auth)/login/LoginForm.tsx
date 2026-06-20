'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoginSchema, MagicLinkSchema } from '@/lib/validation/auth'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = LoginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError('Enter a valid email and password.')
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Refresh server state so Server Components pick up the new session, then navigate.
    router.refresh()
    router.push('/dashboard')
  }

  async function handleMagicLink() {
    setError(null)

    const parsed = MagicLinkSchema.safeParse({ email })
    if (!parsed.success) {
      setError('Enter a valid email to receive a magic link.')
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setMagicSent(true)
  }

  if (magicSent) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
        Check your email for a magic link to sign in.
      </div>
    )
  }

  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      <Input
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <Input
        id="password"
        type="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Logging in…' : 'Log in'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={loading}
        onClick={handleMagicLink}
      >
        Email me a magic link
      </Button>
    </form>
  )
}

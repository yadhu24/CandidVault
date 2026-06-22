'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PASSWORD_MIN, SignupSchema } from '@/lib/validation/auth'

export function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = SignupSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(`Enter a valid email and a password of at least ${PASSWORD_MIN} characters.`)
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      // Email confirmation returns here to exchange the code for a session.
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
        Check your email for a confirmation link to complete sign-up.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}

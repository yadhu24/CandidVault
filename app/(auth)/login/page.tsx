import Link from 'next/link'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Log in to CandidVault</h1>
        <p className="text-sm text-zinc-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="underline">Sign up</Link>
        </p>
        <LoginForm />
      </div>
    </main>
  )
}

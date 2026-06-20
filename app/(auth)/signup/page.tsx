import Link from 'next/link'
import { SignupForm } from './SignupForm'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="underline">Log in</Link>
        </p>
        <SignupForm />
      </div>
    </main>
  )
}

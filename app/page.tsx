import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">CandidVault</h1>
      <p className="max-w-md text-center text-zinc-600">
        Collect every candid moment. Share a QR code — guests upload, you curate.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Sign up free
        </Link>
      </div>
    </main>
  )
}

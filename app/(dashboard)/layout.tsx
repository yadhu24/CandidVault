import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { signOutAction } from '@/lib/auth/actions'
import { requirePhotographer } from '@/lib/account/photographers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Gates the whole (dashboard) segment and bootstraps the photographer profile.
  const { user, profile } = await requirePhotographer()
  const displayName = profile.businessName || user.displayName || user.email

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="font-semibold">
            CandidVault
          </Link>
          <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900">
            Events
          </Link>
          <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-900">
            Settings
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{displayName}</span>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

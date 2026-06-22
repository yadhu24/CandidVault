import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { signOutAction } from '@/lib/auth/actions'
import { requirePhotographer } from '@/lib/account/photographers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Gates the whole (dashboard) segment and bootstraps the photographer profile.
  const { user, profile } = await requirePhotographer()
  const displayName = profile.businessName || user.displayName || user.email

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-5">
            <Link href="/dashboard" className="font-display text-h3 text-foreground">
              CandidVault
            </Link>
            <Link
              href="/dashboard"
              className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Events
            </Link>
            <Link
              href="/settings"
              className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Settings
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-body-sm text-muted-foreground sm:inline">{displayName}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

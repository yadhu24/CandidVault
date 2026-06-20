import { requireAuth } from '@/lib/auth/guards'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white px-6 py-3">
        <span className="font-semibold">CandidVault</span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

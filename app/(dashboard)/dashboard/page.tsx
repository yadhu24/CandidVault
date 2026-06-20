import { requirePhotographer } from '@/lib/account/photographers'

export default async function DashboardPage() {
  const { user, profile } = await requirePhotographer()
  const name = profile.businessName || user.displayName || 'there'

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back, {name}</h1>
      <p className="mt-2 text-zinc-500">No events yet. Create your first one.</p>
      {/* TODO: fetch and list events */}
    </div>
  )
}

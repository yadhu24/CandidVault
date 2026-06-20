import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { requirePhotographer } from '@/lib/account/photographers'
import { ProfileForm } from './ProfileForm'

export default async function SettingsPage() {
  const { user, profile } = await requirePhotographer()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your photographer profile.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Account</h2>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-zinc-500">Email:</span> {user.email}
          </p>
          <p className="text-xs text-zinc-400">
            Your sign-in email is managed through your login provider.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Photographer profile</h2>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              businessName: profile.businessName ?? '',
              contactEmail: profile.contactEmail ?? '',
              contactPhone: profile.contactPhone ?? '',
              websiteUrl: profile.websiteUrl ?? '',
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateProfileAction } from '@/lib/account/actions'
import type { ProfileFormState } from '@/lib/account/types'

interface Props {
  initial: {
    businessName: string
    contactEmail: string
    contactPhone: string
    websiteUrl: string
  }
}

const initialState: ProfileFormState = { ok: false }

export function ProfileForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <Input
        id="businessName"
        name="businessName"
        label="Business name"
        defaultValue={initial.businessName}
        maxLength={120}
        autoComplete="organization"
      />
      <Input
        id="contactEmail"
        name="contactEmail"
        type="email"
        label="Contact email"
        defaultValue={initial.contactEmail}
        maxLength={255}
        autoComplete="email"
      />
      <Input
        id="contactPhone"
        name="contactPhone"
        label="Contact phone"
        defaultValue={initial.contactPhone}
        maxLength={40}
        autoComplete="tel"
      />
      <Input
        id="websiteUrl"
        name="websiteUrl"
        type="url"
        label="Website"
        defaultValue={initial.websiteUrl}
        maxLength={255}
        autoComplete="url"
      />
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}

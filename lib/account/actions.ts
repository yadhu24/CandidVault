'use server'

import { revalidatePath } from 'next/cache'
import { upsertPhotographerProfile } from '@/lib/db/queries/users'
import { ProfileUpdateSchema } from '@/lib/validation/auth'
import { requirePhotographer } from './photographers'
import type { ProfileFormState } from './types'

const emptyToNull = (v: FormDataEntryValue | null): string | null => {
  const t = String(v ?? '').trim()
  return t === '' ? null : t
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  // Identity comes from the session, never from the submitted form (CLAUDE.md §7).
  const { user } = await requirePhotographer()

  const parsed = ProfileUpdateSchema.safeParse({
    businessName: String(formData.get('businessName') ?? ''),
    contactEmail: String(formData.get('contactEmail') ?? ''),
    contactPhone: String(formData.get('contactPhone') ?? ''),
    websiteUrl: String(formData.get('websiteUrl') ?? ''),
  })
  if (!parsed.success) {
    return { ok: false, error: 'Please check the form and try again.' }
  }

  await upsertPhotographerProfile(user.id, {
    businessName: emptyToNull(formData.get('businessName')),
    contactEmail: emptyToNull(formData.get('contactEmail')),
    contactPhone: emptyToNull(formData.get('contactPhone')),
    websiteUrl: emptyToNull(formData.get('websiteUrl')),
  })

  revalidatePath('/settings')
  return { ok: true }
}

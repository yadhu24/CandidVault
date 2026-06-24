import { requirePhotographer } from '@/lib/account/photographers'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'
import type { MediaType, ModerationStatus } from '@/lib/db/types'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { loadModerationPage } from '@/lib/moderation/serialize'
import type { ModerationTypeFilter } from '@/lib/moderation/types'
import { ModerationQueue } from './ModerationQueue'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: string; type?: string }>
}

const STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected']

export default async function EventUploadsPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const status: ModerationStatus = STATUSES.includes(sp.status as ModerationStatus)
    ? (sp.status as ModerationStatus)
    : 'pending'
  const mediaType: MediaType | undefined =
    sp.type === 'photo' || sp.type === 'video' ? sp.type : undefined
  const typeFilter: ModerationTypeFilter = mediaType ?? 'all'

  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id) // ownership; notFound otherwise

  const [initial, counts] = await Promise.all([
    loadModerationPage(event.id, { moderationStatus: status, mediaType, offset: 0 }),
    countUploadsByModeration(event.id),
  ])

  return (
    <ModerationQueue
      // Remounting per filter resets the loaded list + selection cleanly.
      key={`${status}-${typeFilter}`}
      eventId={event.id}
      status={status}
      mediaType={typeFilter}
      counts={counts}
      initial={initial}
    />
  )
}

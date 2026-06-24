import { apiError, apiJson } from '@/lib/http/responses'
import { requirePhotographer } from '@/lib/account/photographers'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import type { MediaType, ModerationStatus } from '@/lib/db/types'
import { loadModerationPage } from '@/lib/moderation/serialize'

interface Params {
  params: Promise<{ id: string }>
}

const STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected']

// GET /api/events/[id]/uploads?status=&type=&offset=
// Load-more feed for the moderation queue. Owner-only: identity from the session,
// event ownership verified before any read. Returns presigned thumbnail URLs —
// never storage keys.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getEventByIdForPhotographer(id, user.id)
  if (!event) return apiError(404, 'EVENT_NOT_FOUND', 'This event could not be found.')

  const sp = new URL(request.url).searchParams
  const statusParam = sp.get('status') as ModerationStatus
  const status: ModerationStatus = STATUSES.includes(statusParam) ? statusParam : 'pending'
  const typeParam = sp.get('type')
  const mediaType: MediaType | undefined =
    typeParam === 'photo' || typeParam === 'video' ? typeParam : undefined
  const offset = Math.max(0, Number(sp.get('offset') ?? 0) | 0)

  const page = await loadModerationPage(event.id, { moderationStatus: status, mediaType, offset })
  return apiJson(page, 200)
}

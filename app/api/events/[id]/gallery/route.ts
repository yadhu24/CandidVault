import { apiError, apiJson } from '@/lib/http/responses'
import { requirePhotographer } from '@/lib/account/photographers'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import type { MediaType } from '@/lib/db/types'
import { loadGalleryPage } from '@/lib/gallery/serialize'
import type { GallerySort } from '@/lib/gallery/types'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/events/[id]/gallery?type=&sort=&offset=
// Load-more feed for the approved gallery. Owner-only: identity from the session,
// event ownership verified before any read. Returns presigned thumbnail/preview
// URLs — never storage keys.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getEventByIdForPhotographer(id, user.id)
  if (!event) return apiError(404, 'EVENT_NOT_FOUND', 'This event could not be found.')

  const sp = new URL(request.url).searchParams
  const sort: GallerySort = sp.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const typeParam = sp.get('type')
  const mediaType: MediaType | undefined =
    typeParam === 'photo' || typeParam === 'video' ? typeParam : undefined
  const offset = Math.max(0, Number(sp.get('offset') ?? 0) | 0)
  const favoritesOnly = sp.get('fav') === '1'

  const page = await loadGalleryPage(event.id, { mediaType, sort, offset, favoritesOnly })
  return apiJson(page, 200)
}

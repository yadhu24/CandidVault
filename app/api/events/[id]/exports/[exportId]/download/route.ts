import { apiError } from '@/lib/http/responses'
import { requirePhotographer } from '@/lib/account/photographers'
import { getEventByIdForPhotographer } from '@/lib/db/queries/events'
import { getExportForEvent } from '@/lib/db/queries/exports'
import { createDownloadPresignedUrl } from '@/lib/storage'

interface Params {
  params: Promise<{ id: string; exportId: string }>
}

// GET /api/events/[id]/exports/[exportId]/download
// Owner-only. Mints a FRESH short-lived presigned GET on each click (so the link
// is always signed + expiring) and redirects to it. Refuses if the export isn't
// ready or has passed its retention window.
export async function GET(_req: Request, { params }: Params) {
  const { id, exportId } = await params
  const { user } = await requirePhotographer()
  const event = await getEventByIdForPhotographer(id, user.id)
  if (!event) return apiError(404, 'EVENT_NOT_FOUND', 'This event could not be found.')

  const exp = await getExportForEvent(exportId, event.id)
  if (!exp || exp.status !== 'ready' || !exp.storageKey) {
    return apiError(404, 'EXPORT_NOT_READY', 'This export is not available.')
  }
  if (exp.expiresAt && new Date(exp.expiresAt).getTime() < Date.now()) {
    return apiError(410, 'EXPORT_EXPIRED', 'This export has expired. Please request a new one.')
  }

  const url = await createDownloadPresignedUrl(exp.storageKey)
  return Response.redirect(url, 302)
}

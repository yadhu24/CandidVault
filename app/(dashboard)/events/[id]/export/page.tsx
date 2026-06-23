import { requirePhotographer } from '@/lib/account/photographers'
import { listExportsByEvent } from '@/lib/db/queries/exports'
import { countUploadsByModeration } from '@/lib/db/queries/moderation'
import { getOwnedEventOrNotFound } from '@/lib/events/service'
import { ExportPanel, type ExportRow } from './ExportPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventExportPage({ params }: Props) {
  const { id } = await params
  const { user } = await requirePhotographer()
  const event = await getOwnedEventOrNotFound(id, user.id) // ownership; notFound otherwise

  const [counts, exports] = await Promise.all([
    countUploadsByModeration(event.id),
    listExportsByEvent(event.id),
  ])

  // Slim, presentation-only rows — never expose the private storage key here.
  const rows: ExportRow[] = exports.map((e) => ({
    id: e.id,
    status: e.status,
    itemCount: e.itemCount,
    fileSizeBytes: e.fileSizeBytes,
    errorDetail: e.errorDetail,
    expiresAt: e.expiresAt,
    createdAt: e.createdAt,
  }))

  return <ExportPanel eventId={event.id} approvedCount={counts.approved} exports={rows} />
}

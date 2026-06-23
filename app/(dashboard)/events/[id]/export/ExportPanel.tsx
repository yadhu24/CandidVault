'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, EmptyState, Spinner, StatusPill } from '@/components/ui'
import { AlertIcon, DownloadIcon, FolderIcon, RetryIcon } from '@/components/ui/icons'
import { requestExportAction } from '@/lib/exports/actions'
import { formatBytes, formatRelativeTime } from '@/lib/uploads/format'
import type { ProcessingStatus } from '@/lib/db/types'

export interface ExportRow {
  id: string
  status: ProcessingStatus
  itemCount: number | null
  fileSizeBytes: number | null
  errorDetail: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  eventId: string
  approvedCount: number
  exports: ExportRow[]
}

const POLL_MS = 4000 // how often we re-check a building export

function isInFlight(row: ExportRow | undefined): boolean {
  return row?.status === 'pending' || row?.status === 'processing'
}

function isExpired(row: ExportRow): boolean {
  return row.expiresAt != null && new Date(row.expiresAt).getTime() < Date.now()
}

export function ExportPanel({ eventId, approvedCount, exports }: Props) {
  const router = useRouter()
  const [pending, startRequest] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const latest = exports[0]
  const building = isInFlight(latest)

  // While an export is building, the worker updates its row out-of-band, so poll
  // the server component for fresh status. Stops as soon as it's no longer building.
  useEffect(() => {
    if (!building) return
    const timer = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(timer)
  }, [building, router])

  function requestExport() {
    setError(null)
    startRequest(async () => {
      const res = await requestExportAction(eventId)
      if (!res.ok) setError(res.error ?? 'Could not start the export.')
      else router.refresh()
    })
  }

  const canRequest = approvedCount > 0 && !building && !pending

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-h3 text-foreground">Export approved media</h2>
            <p className="mt-0.5 text-body-sm text-muted-foreground">
              Bundle every approved photo and video into a single ZIP of the original files.
            </p>
          </div>
          <Button onClick={requestExport} disabled={!canRequest} isLoading={pending}>
            {building ? 'Building…' : 'Request export'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-body-sm text-muted-foreground">
            {approvedCount > 0
              ? `${approvedCount} approved item${approvedCount === 1 ? '' : 's'} ready to export.`
              : 'No approved items yet — approve uploads in the Uploads tab before exporting.'}
          </p>

          {building && (
            <div className="flex items-center gap-2 rounded-lg border border-info-border bg-info-subtle px-3 py-2 text-info-subtle-foreground">
              <Spinner className="size-4" />
              <span className="text-body-sm">
                Building your ZIP. This can take a few minutes for large events — you can leave and
                come back.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-destructive-subtle-foreground">
              <AlertIcon className="size-4 shrink-0" />
              <span className="text-body-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="font-display text-h3 text-foreground">Export history</h3>
        {exports.length === 0 ? (
          <EmptyState
            icon={<FolderIcon className="size-6" />}
            title="No exports yet"
            description="Request an export and it will appear here, ready to download when it’s built."
          />
        ) : (
          <ul className="space-y-2">
            {exports.map((row) => (
              <ExportItem key={row.id} eventId={eventId} row={row} onRetry={requestExport} retrying={pending} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ExportItem({
  eventId,
  row,
  onRetry,
  retrying,
}: {
  eventId: string
  row: ExportRow
  onRetry: () => void
  retrying: boolean
}) {
  const expired = row.status === 'ready' && isExpired(row)
  const downloadable = row.status === 'ready' && !expired

  return (
    <li>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusPill status={expired ? 'failed' : row.status} />
              <span className="text-body-sm text-muted-foreground">
                Requested {formatRelativeTime(row.createdAt)}
              </span>
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {row.status === 'ready' && row.itemCount != null
                ? `${row.itemCount} file${row.itemCount === 1 ? '' : 's'}` +
                  (row.fileSizeBytes ? ` · ${formatBytes(row.fileSizeBytes)}` : '')
                : null}
              {row.status === 'ready' && !expired && row.expiresAt
                ? ` · available until ${new Date(row.expiresAt).toLocaleDateString()}`
                : null}
              {expired ? 'Download link expired — request a fresh export.' : null}
              {row.status === 'failed' ? row.errorDetail ?? 'Export failed.' : null}
              {row.status === 'processing' ? 'Building…' : null}
              {row.status === 'pending' ? 'Queued…' : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {downloadable && (
              // Anchor (not fetch) so the browser follows the route's 302 to a fresh
              // signed R2 URL and downloads directly — media never proxies through us.
              <a
                href={`/api/events/${eventId}/exports/${row.id}/download`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-body-sm font-medium text-primary-foreground transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <DownloadIcon className="size-4" />
                Download
              </a>
            )}
            {(row.status === 'failed' || expired) && (
              <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
                <RetryIcon className="size-4" />
                Retry
              </Button>
            )}
            {row.status === 'processing' && <Spinner className="size-4 text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

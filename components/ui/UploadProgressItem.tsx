import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { CheckIcon, ImageIcon, RetryIcon, TrashIcon } from './icons'

export type UploadItemStatus = 'queued' | 'uploading' | 'finalizing' | 'done' | 'error'

interface UploadProgressItemProps {
  name: string
  status: UploadItemStatus
  /** 0–100, used while uploading/finalizing. */
  progress?: number
  error?: string
  thumbnailUrl?: string
  onRetry?: () => void
  onRemove?: () => void
  className?: string
}

// One row per file in an upload queue: thumbnail, name, live progress, and
// per-file recovery actions. Pure/presentational — drive it from parent state.
export function UploadProgressItem({
  name,
  status,
  progress = 0,
  error,
  thumbnailUrl,
  onRetry,
  onRemove,
  className,
}: UploadProgressItemProps) {
  const active = status === 'uploading' || status === 'finalizing'

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-card p-3',
        status === 'error' && 'border-destructive-border',
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-body-sm font-medium text-foreground">{name}</span>
          <StatusIndicator status={status} progress={progress} onRetry={onRetry} onRemove={onRemove} />
        </div>

        {active && (
          <div
            role="progressbar"
            aria-valuenow={status === 'finalizing' ? undefined : Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Uploading ${name}`}
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full bg-primary transition-all duration-300',
                status === 'finalizing' && 'animate-pulse',
              )}
              style={{ width: `${status === 'finalizing' ? 100 : progress}%` }}
            />
          </div>
        )}

        {status === 'error' && error && <p className="mt-1 text-caption text-destructive">{error}</p>}
      </div>
    </div>
  )
}

function StatusIndicator({
  status,
  progress,
  onRetry,
  onRemove,
}: {
  status: UploadItemStatus
  progress: number
  onRetry?: () => void
  onRemove?: () => void
}) {
  switch (status) {
    case 'queued':
      return <span className="shrink-0 text-caption text-muted-foreground">Queued</span>
    case 'uploading':
      return (
        <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
          {Math.round(progress)}%
        </span>
      )
    case 'finalizing':
      return (
        <span className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground">
          <Spinner className="size-3.5" label="Finishing upload" />
          Finishing…
        </span>
      )
    case 'done':
      return (
        <span className="flex shrink-0 items-center gap-1 text-caption font-medium text-success">
          <CheckIcon className="size-4" />
          Uploaded
        </span>
      )
    case 'error':
      return (
        <span className="flex shrink-0 items-center gap-1">
          {onRetry && (
            <IconButton label="Retry upload" onClick={onRetry}>
              <RetryIcon className="size-4" />
            </IconButton>
          )}
          {onRemove && (
            <IconButton label="Remove file" onClick={onRemove}>
              <TrashIcon className="size-4" />
            </IconButton>
          )}
        </span>
      )
  }
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

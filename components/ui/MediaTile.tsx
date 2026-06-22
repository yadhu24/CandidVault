import Link from 'next/link'
import { cn } from '@/lib/utils'
import { StatusPill, type Status } from './StatusPill'
import { CheckIcon, ImageIcon, PlayIcon, StarIcon } from './icons'

interface MediaTileProps {
  /** Thumbnail URL. When omitted, a typed placeholder is shown (e.g. a video
   * whose poster hasn't been generated yet). */
  src?: string
  alt: string
  type?: 'photo' | 'video'
  /** e.g. "0:42" */
  durationLabel?: string
  status?: Status
  href?: string
  onClick?: () => void
  selected?: boolean
  onToggleSelect?: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
  className?: string
}

// A single media thumbnail for the gallery grid. Photo or video, with optional
// moderation status, a selection checkbox, and a stretched primary action
// (link or button) that fills the tile without nesting interactive elements.
export function MediaTile({
  src,
  alt,
  type = 'photo',
  durationLabel,
  status,
  href,
  onClick,
  selected = false,
  onToggleSelect,
  favorite = false,
  onToggleFavorite,
  className,
}: MediaTileProps) {
  const interactive = Boolean(href || onClick)

  return (
    <figure
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg bg-muted',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={interactive ? '' : alt}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          {type === 'video' ? <PlayIcon className="size-8" /> : <ImageIcon className="size-8" />}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {href ? (
        <Link
          href={href}
          className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="sr-only">{alt}</span>
        </Link>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 z-10 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="sr-only">{alt}</span>
        </button>
      ) : null}

      {type === 'video' && src && (
        <span className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <PlayIcon className="size-5" />
          </span>
        </span>
      )}

      {durationLabel && (
        <span className="pointer-events-none absolute right-1.5 bottom-1.5 z-[5] rounded bg-black/60 px-1.5 py-0.5 text-caption font-medium tabular-nums text-white">
          {durationLabel}
        </span>
      )}

      {status && (
        <div className="pointer-events-none absolute top-1.5 right-1.5 z-[5]">
          <StatusPill status={status} />
        </div>
      )}

      {onToggleFavorite && (
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={onToggleFavorite}
          className="absolute top-1.5 right-1.5 z-20 inline-flex size-7 items-center justify-center rounded-md bg-black/30 text-white outline-none backdrop-blur-sm transition-colors hover:bg-black/45 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StarIcon className={cn('size-4', favorite && 'fill-current text-gold-300')} />
        </button>
      )}

      {onToggleSelect && (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={selected ? 'Deselect' : 'Select'}
          onClick={onToggleSelect}
          className={cn(
            'absolute top-1.5 left-1.5 z-20 inline-flex size-7 items-center justify-center rounded-md border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-white/70 bg-black/30 text-transparent backdrop-blur-sm hover:bg-black/45',
          )}
        >
          <CheckIcon className="size-4" />
        </button>
      )}
    </figure>
  )
}

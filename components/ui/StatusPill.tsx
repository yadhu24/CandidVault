import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Moderation + processing states for an upload. Color is never the only signal:
// every pill carries a text label (and a dot), so it reads under colorblindness.
export type Status = 'pending' | 'approved' | 'rejected' | 'processing' | 'ready' | 'failed'

type Tone = 'warning' | 'success' | 'destructive' | 'info'

const STATUS: Record<Status, { tone: Tone; label: string; pulse?: boolean }> = {
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'destructive', label: 'Rejected' },
  processing: { tone: 'info', label: 'Processing', pulse: true },
  ready: { tone: 'success', label: 'Ready' },
  failed: { tone: 'destructive', label: 'Failed' },
}

// Full class strings (not interpolated) so Tailwind's scanner keeps them.
const TONE: Record<Tone, { pill: string; dot: string }> = {
  warning: {
    pill: 'bg-warning-subtle text-warning-subtle-foreground border-warning-border',
    dot: 'bg-warning',
  },
  success: {
    pill: 'bg-success-subtle text-success-subtle-foreground border-success-border',
    dot: 'bg-success',
  },
  destructive: {
    pill: 'bg-destructive-subtle text-destructive-subtle-foreground border-destructive-border',
    dot: 'bg-destructive',
  },
  info: {
    pill: 'bg-info-subtle text-info-subtle-foreground border-info-border',
    dot: 'bg-info',
  },
}

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status
  /** Show the leading status dot. Defaults to true. */
  dot?: boolean
}

export function StatusPill({ status, dot = true, className, ...props }: StatusPillProps) {
  const { tone, label, pulse } = STATUS[status]
  const styles = TONE[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-medium',
        styles.pill,
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', styles.dot, pulse && 'animate-pulse')}
        />
      )}
      {label}
    </span>
  )
}

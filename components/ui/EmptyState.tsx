import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Primary call-to-action (e.g. a Button). */
  action?: ReactNode
  className?: string
}

// Calm, centered placeholder for "nothing here yet" surfaces. Generous
// whitespace keeps it feeling premium rather than broken.
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-h3 text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

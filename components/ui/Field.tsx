import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Shared control styling for native <select>/<textarea>, so they match the Input
// primitive (semantic tokens, focus ring). Pair with a fixed height for selects.
export const fieldControlClassName =
  'w-full rounded-md border border-input bg-card px-3 text-body-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50'

// Label + error wrapper for form controls that aren't the Input primitive (native
// select/textarea). Mirrors Input's spacing and error treatment.
export function Field({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

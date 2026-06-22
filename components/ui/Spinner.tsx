import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  /** Accessible label announced to assistive tech. */
  label?: string
}

// Indeterminate loading spinner. Inherits color from `text-*`; size with `size-*`.
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={cn('size-4 animate-spin text-current', className)}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-muted text-muted-foreground border-transparent',
  success: 'bg-success-subtle text-success-subtle-foreground border-success-border',
  warning: 'bg-warning-subtle text-warning-subtle-foreground border-warning-border',
  error: 'bg-destructive-subtle text-destructive-subtle-foreground border-destructive-border',
  info: 'bg-info-subtle text-info-subtle-foreground border-info-border',
  accent: 'bg-accent text-accent-foreground border-transparent',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

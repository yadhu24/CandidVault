import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Content placeholder with a subtle shimmer (disabled under prefers-reduced-motion
// via the global rule in globals.css). Size it with width/height utilities.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent',
        'dark:after:via-white/5',
        className,
      )}
      {...props}
    />
  )
}

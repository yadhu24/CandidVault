import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Responsive gallery grid: 2 columns on phones, scaling up on larger screens.
// Holds MediaTile children (or Skeletons while loading).
export function MediaGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
      {...props}
    />
  )
}

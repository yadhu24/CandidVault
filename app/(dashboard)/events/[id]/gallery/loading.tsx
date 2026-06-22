import { MediaGrid, Skeleton } from '@/components/ui'

// Shown while the gallery's first page loads (initial visit + filter/sort change).
export default function GalleryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
      <MediaGrid>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </MediaGrid>
    </div>
  )
}

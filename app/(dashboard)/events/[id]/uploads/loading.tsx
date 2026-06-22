import { Card, CardContent, Skeleton } from '@/components/ui'

// Shown while the moderation queue loads (initial visit + filter navigation).
export default function ModerationLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square rounded-none" />
            <CardContent className="space-y-3 py-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

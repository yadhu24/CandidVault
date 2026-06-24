import { Card, CardContent, CardHeader, Skeleton } from '@/components/ui'

// Shown while the Export tab loads approved counts + export history.
export default function ExportLoading() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </CardContent>
      </Card>
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

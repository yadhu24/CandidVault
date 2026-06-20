import { Card, CardContent } from '@/components/ui/Card'

export function SectionPlaceholder({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description ?? 'Coming soon.'}</p>
      </CardContent>
    </Card>
  )
}

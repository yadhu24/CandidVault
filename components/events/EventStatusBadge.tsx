import { Badge } from '@/components/ui/Badge'
import type { EventStatus } from '@/types'

const VARIANT: Record<EventStatus, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  active: 'success',
  closed: 'default',
}

const LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
}

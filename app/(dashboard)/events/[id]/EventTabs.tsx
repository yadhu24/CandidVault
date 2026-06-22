'use client'

import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { cn } from '@/lib/utils'

// `segment` is the active child segment: null for the index (overview) route.
const TABS = [
  { segment: null, label: 'Overview', path: '' },
  { segment: 'uploads', label: 'Uploads', path: '/uploads' },
  { segment: 'gallery', label: 'Gallery', path: '/gallery' },
  { segment: 'albums', label: 'Albums', path: '/albums' },
  { segment: 'export', label: 'Export', path: '/export' },
  { segment: 'settings', label: 'Settings', path: '/settings' },
] as const

export function EventTabs({ eventId }: { eventId: string }) {
  const active = useSelectedLayoutSegment()

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = active === tab.segment
        return (
          <Link
            key={tab.label}
            href={`/events/${eventId}${tab.path}`}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-body-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

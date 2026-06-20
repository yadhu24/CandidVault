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
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200">
      {TABS.map((tab) => {
        const isActive = active === tab.segment
        return (
          <Link
            key={tab.label}
            href={`/events/${eventId}${tab.path}`}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-900',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

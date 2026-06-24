import type { ModerationStatus } from '@/lib/db/types'

export type ModerationTypeFilter = 'all' | 'photo' | 'video'

// One card in the moderation queue. Storage keys never reach the client — only a
// short-lived presigned thumbnail URL (or null until the worker has made one).
export interface QueueItem {
  id: string
  mediaType: 'photo' | 'video'
  status: ModerationStatus
  sizeLabel: string
  timeLabel: string
  uploaderName: string | null
  durationLabel?: string
  thumbUrl: string | null
}

export interface ModerationPage {
  items: QueueItem[]
  nextOffset: number | null
}

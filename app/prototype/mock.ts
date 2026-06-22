// Mock data + helpers for the click-through prototypes. No backend, no auth —
// these screens exist to validate the design before the real pages are wired up.
import type { Status } from '@/components/ui'

// Inline gradient "photos" so the prototype needs no network or real assets.
export function tile(from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='400' height='400' fill='url(#g)'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const PAIRS: [string, string][] = [
  ['#e36e8a', '#b53a57'],
  ['#d0a53d', '#9a6e22'],
  ['#b5a892', '#564e43'],
  ['#ef9fb2', '#d24c6b'],
  ['#ddbe63', '#7b561f'],
  ['#c95e3c', '#7d2a41'],
  ['#e7dfd4', '#b5a892'],
  ['#f2cbba', '#c95e3c'],
  ['#a7c4bc', '#5b7f76'],
  ['#d6c9b9', '#8c8071'],
  ['#efa29d', '#97302e'],
  ['#e8c07a', '#8a5e10'],
]

export function thumbFor(i: number) {
  const [a, b] = PAIRS[i % PAIRS.length]
  return tile(a, b)
}

export interface MockEvent {
  id: string
  name: string
  date: string
  venue: string
  slug: string
  status: 'active' | 'draft' | 'closed'
  scans: number
  uploads: number
  approved: number
  pending: number
  exports: number
}

export const EVENT: MockEvent = {
  id: 'evt_aarav_meera',
  name: 'Aarav & Meera',
  date: '14 February 2026',
  venue: 'The Leela Palace, Udaipur',
  slug: 'aarav-meera',
  status: 'active',
  scans: 312,
  uploads: 248,
  approved: 180,
  pending: 54,
  exports: 2,
}

export const EVENTS: MockEvent[] = [
  EVENT,
  {
    id: 'evt_sharma_25',
    name: 'Sharma 25th Anniversary',
    date: '2 March 2026',
    venue: 'ITC Grand, Bengaluru',
    slug: 'sharma-25',
    status: 'active',
    scans: 96,
    uploads: 71,
    approved: 60,
    pending: 11,
    exports: 0,
  },
  {
    id: 'evt_diya_mehndi',
    name: "Diya's Mehndi",
    date: '20 March 2026',
    venue: 'Home, Jaipur',
    slug: 'diya-mehndi',
    status: 'draft',
    scans: 0,
    uploads: 0,
    approved: 0,
    pending: 0,
    exports: 0,
  },
  {
    id: 'evt_rohan_kavya',
    name: 'Rohan & Kavya',
    date: '8 December 2025',
    venue: 'Taj Falaknuma, Hyderabad',
    slug: 'rohan-kavya',
    status: 'closed',
    scans: 540,
    uploads: 433,
    approved: 410,
    pending: 0,
    exports: 5,
  },
]

export interface MockUpload {
  id: string
  type: 'photo' | 'video'
  sizeLabel: string
  timeLabel: string
  uploader?: string
  status: Status
  duration?: string
}

const NAMES = ['Priya', 'Rahul', 'Aunty Sunita', 'Vikram', 'Neha', undefined, 'Arjun', 'Meera’s cousin']

export const UPLOADS: MockUpload[] = Array.from({ length: 18 }).map((_, i) => {
  const isVideo = i % 5 === 2
  return {
    id: `up_${i}`,
    type: isVideo ? 'video' : 'photo',
    sizeLabel: isVideo ? `${(8 + (i % 4) * 6).toFixed(1)} MB` : `${(1.4 + (i % 5) * 0.7).toFixed(1)} MB`,
    timeLabel: i < 4 ? `${2 + i}m ago` : i < 10 ? `${i * 6}m ago` : `${i - 8}h ago`,
    uploader: NAMES[i % NAMES.length],
    status: 'pending',
    duration: isVideo ? `0:${String(12 + i).padStart(2, '0')}` : undefined,
  }
})

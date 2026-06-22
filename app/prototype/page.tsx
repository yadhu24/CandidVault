import Link from 'next/link'
import { Badge, Card, CardContent } from '@/components/ui'
import {
  CameraIcon,
  ChevronRightIcon,
  ImageIcon,
  InboxIcon,
  MapPinIcon,
  SparkleIcon,
} from '@/components/ui/icons'

const SCREENS = [
  {
    href: '/prototype/guest',
    title: 'Guest upload',
    desc: 'The hero screen. Fully interactive — landing, multi-file upload, success, per-file error & retry, closed & invalid links.',
    icon: <CameraIcon className="size-6" />,
    featured: true,
  },
  {
    href: '/prototype/dashboard',
    title: 'Photographer dashboard',
    desc: 'Events list with counts and status, Create Event CTA, and the first-time empty state.',
    icon: <SparkleIcon className="size-6" />,
  },
  {
    href: '/prototype/event',
    title: 'Event detail',
    desc: 'Overview with key stats, the guest-upload QR (copy link / download), and tabbed sections.',
    icon: <MapPinIcon className="size-6" />,
  },
  {
    href: '/prototype/moderation',
    title: 'Moderation queue',
    desc: 'Fast-scan grid, single + bulk approve/reject, status & type filters, empty and loading states.',
    icon: <InboxIcon className="size-6" />,
  },
  {
    href: '/prototype/gallery',
    title: 'Approved gallery',
    desc: 'Responsive media grid, filter + sort, and a preview modal. Empty state included.',
    icon: <ImageIcon className="size-6" />,
  },
]

export default function PrototypeIndex() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-overline uppercase text-primary">CandidVault</p>
        <h1 className="mt-1 font-display text-display text-foreground">Prototypes</h1>
        <p className="mt-3 max-w-xl text-body text-muted-foreground">
          Click-through screens built from the design system — mock data, no login or backend.
          Start with the guest upload flow; it&apos;s the screen the product wins or loses on.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-accent/40 px-4 py-3 text-body-sm text-foreground">
          📱 Try it on your phone: open the <span className="font-medium">Network URL</span> from{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-caption">npm run dev</code> (e.g.{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-caption">http://192.168.x.x:3000/prototype/guest</code>)
          and click through the upload flow one-handed.
        </div>

        <div className="mt-8 space-y-3">
          {SCREENS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className={s.featured ? 'border-primary/40' : undefined}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
                    {s.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-h3 text-foreground">{s.title}</h2>
                      {s.featured && <Badge variant="accent">Start here</Badge>}
                    </div>
                    <p className="mt-0.5 text-body-sm text-muted-foreground">{s.desc}</p>
                  </div>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-caption text-muted-foreground">
          See also the{' '}
          <Link href="/design-system" className="text-primary underline-offset-4 hover:underline">
            design system reference
          </Link>
          .
        </p>
      </main>
    </div>
  )
}

import Link from 'next/link'
import { ChevronRightIcon } from '@/components/ui/icons'

// Shared chrome for the desktop-style prototype screens (not the guest screen,
// which is intentionally full-bleed mobile).
export function ProtoBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 text-body-sm">
          <Link href="/prototype" className="shrink-0 text-muted-foreground hover:text-foreground">
            Prototypes
          </Link>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium text-foreground">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </div>
  )
}

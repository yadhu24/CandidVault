'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from './icons'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  /** 'right' = side panel (desktop), 'bottom' = sheet (mobile). */
  side?: 'right' | 'bottom'
  children: ReactNode
  footer?: ReactNode
  className?: string
}

// Slide-in panel. Closes on Escape / overlay click, locks body scroll, moves
// focus into the panel on open and restores it on close. Stays mounted but is
// marked `inert` while closed, so its contents leave the tab order.
export function Drawer({ open, onClose, title, side = 'right', children, footer, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => panelRef.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      restoreFocusRef.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <div className={cn('fixed inset-0 z-50', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-overlay transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        inert={!open}
        className={cn(
          'absolute flex flex-col bg-popover text-popover-foreground shadow-xl outline-none transition-transform duration-300 ease-out',
          side === 'right' &&
            ['top-0 right-0 h-full w-full max-w-md border-l border-border', open ? 'translate-x-0' : 'translate-x-full'],
          side === 'bottom' &&
            ['bottom-0 left-0 max-h-[85vh] w-full rounded-t-2xl border-t border-border', open ? 'translate-y-0' : 'translate-y-full'],
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          {title ? (
            <h2 id={titleId} className="text-h2 font-display text-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-m-1.5 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

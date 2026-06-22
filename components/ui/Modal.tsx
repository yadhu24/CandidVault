'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CloseIcon } from './icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

// Centered dialog. Closes on Escape / overlay click, locks body scroll, moves
// focus into the dialog on open and restores it on close.
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-md rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl outline-none',
          className,
        )}
      >
        <div className={cn('mb-4 flex items-start justify-between gap-4', !title && 'mb-0')}>
          {title && (
            <h2 id={titleId} className="text-h2 font-display text-foreground">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-m-1.5 ml-auto inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

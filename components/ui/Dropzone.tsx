'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { UploadIcon } from './icons'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  /** e.g. "image/jpeg,image/png,video/mp4" */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  /** On mobile, open the camera directly. */
  capture?: boolean | 'user' | 'environment'
  title?: string
  hint?: string
  icon?: ReactNode
  className?: string
  id?: string
}

// Large, tap-friendly upload target with drag-and-drop. The file input overlays
// the whole zone, so the entire area is clickable and keyboard-focusable; the
// container shows a visible focus ring via `has-[input:focus-visible]`.
export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  disabled = false,
  capture,
  title = 'Tap to add photos & videos',
  hint,
  icon,
  className,
  id,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false)

  function emit(list: FileList | null) {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
  }

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setDragging(false)
        emit(e.dataTransfer.files)
      }}
      className={cn(
        'group relative flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input bg-card px-6 py-10 text-center transition-colors',
        'hover:border-primary/60 hover:bg-primary-50/40 dark:hover:bg-primary-950/20',
        'has-[input:focus-visible]:border-primary has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background',
        dragging && 'border-primary bg-primary-50/60 dark:bg-primary-950/30',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        disabled={disabled}
        onChange={(e) => {
          emit(e.target.files)
          e.currentTarget.value = ''
        }}
        aria-label={title}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span className="pointer-events-none flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
        {icon ?? <UploadIcon className="size-6" />}
      </span>
      <span className="pointer-events-none text-h3 text-foreground">{title}</span>
      {hint && <span className="pointer-events-none text-caption text-muted-foreground">{hint}</span>}
    </div>
  )
}

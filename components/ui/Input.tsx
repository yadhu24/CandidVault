import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-body-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-11 w-full rounded-md border border-input bg-card px-3 text-body-sm text-foreground',
            'placeholder:text-muted-foreground/70',
            'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-caption text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows a spinner, sets aria-busy, and blocks interaction. */
  isLoading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-xs hover:brightness-95 active:brightness-90 dark:hover:brightness-110',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-sand-200 dark:hover:brightness-125',
  ghost: 'text-foreground hover:bg-muted',
  outline: 'border border-input bg-transparent text-foreground hover:bg-muted',
  destructive:
    'bg-destructive text-destructive-foreground shadow-xs hover:brightness-95 active:brightness-90 dark:hover:brightness-110',
}

// md/lg/icon meet the 44px minimum touch target; sm (36px) is for dense desktop.
const sizeStyles: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3 text-body-sm',
  md: 'h-11 gap-2 px-4 text-body-sm',
  lg: 'h-12 gap-2 px-6 text-body',
  icon: 'size-11',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-md font-medium transition-[filter,background-color,color,border-color] duration-150',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {isLoading && <Spinner className="size-4" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

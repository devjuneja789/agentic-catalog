import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-thread text-ink hover:bg-thread-dim disabled:bg-thread/40',
  secondary: 'bg-surface-raised text-linen border border-dust/20 hover:border-thread/50 disabled:opacity-50',
  ghost: 'bg-transparent text-dust hover:text-linen hover:bg-surface-raised disabled:opacity-50',
  danger: 'bg-rust/15 text-rust border border-rust/40 hover:bg-rust/25 disabled:opacity-50',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`focus-thread inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}

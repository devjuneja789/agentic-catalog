import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'razorpay'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-[#3395FF] to-[#1475E1] text-white hover:from-[#4EA4FF] hover:to-[#3395FF] shadow-md shadow-blue-500/20 border border-blue-400/30 active:scale-[0.98]',
  secondary:
    'bg-surface-raised text-linen border border-white/[0.09] hover:bg-surface-highlight hover:border-white/[0.18] hover:text-white',
  ghost:
    'bg-transparent text-dust hover:text-white hover:bg-white/[0.06]',
  danger:
    'bg-rust/10 text-rust border border-rust/30 hover:bg-rust/20 hover:border-rust/50',
  razorpay:
    'bg-[#0C2340] hover:bg-[#143B6D] text-white font-semibold shadow-lg shadow-blue-900/30 border border-[#3395FF]/40 active:scale-[0.98]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2.5 font-medium',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`focus-thread inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
}

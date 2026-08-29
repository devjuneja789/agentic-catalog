import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`focus-thread w-full rounded-md border border-dust/20 bg-surface-raised px-3 py-2 text-sm text-linen placeholder:text-dust/60 ${className}`}
      {...rest}
    />
  )
}

import type { ReactNode } from 'react'

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-dust/15 bg-surface ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-dust/10 px-5 py-4">
          {title && <h2 className="font-display text-lg font-semibold text-linen">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

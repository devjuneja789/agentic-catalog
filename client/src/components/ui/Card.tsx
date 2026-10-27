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
    <div
      className={`relative overflow-hidden rounded-xl border border-white/[0.08] bg-surface/90 backdrop-blur-md shadow-2xl transition-all duration-300 hover:border-white/[0.14] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.01] px-5 py-3.5">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-linen">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

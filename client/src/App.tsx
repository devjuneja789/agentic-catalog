import { useEffect, useState } from 'react'
import { getHealth } from './api/client'

type HealthStatus = 'checking' | 'ok' | 'error'

const statusStyles: Record<HealthStatus, string> = {
  checking: 'bg-yellow-100 text-yellow-800',
  ok: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
}

const statusText: Record<HealthStatus, string> = {
  checking: 'Checking server...',
  ok: 'Server connected',
  error: 'Server unreachable — run `npm run dev` from the repo root',
}

function App() {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    getHealth()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Agentic Catalog</h1>
        <p className="mt-2 text-sm text-slate-500">
          Phase 0 scaffold — client, server, and Tailwind are wired up.
        </p>
        <div
          className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${statusStyles[status]}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {statusText[status]}
        </div>
      </div>
    </div>
  )
}

export default App

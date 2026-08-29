import { useEffect, useState, type ReactNode } from 'react'
import { getHealth } from './api/client'
import { Dashboard } from './pages/Dashboard'
import { CatalogAdmin } from './pages/CatalogAdmin'

type Page = 'dashboard' | 'catalog'
type HealthStatus = 'checking' | 'ok' | 'error'

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-thread block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-thread/15 text-thread' : 'text-dust hover:bg-surface-raised hover:text-linen'
      }`}
    >
      {children}
    </button>
  )
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [health, setHealth] = useState<HealthStatus>('checking')

  useEffect(() => {
    getHealth()
      .then(() => setHealth('ok'))
      .catch(() => setHealth('error'))
  }, [])

  return (
    <div className="flex min-h-screen bg-ink text-linen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-dust/10 bg-surface px-4 py-6">
        <div className="mb-8">
          <div className="font-display text-xl font-semibold text-linen">Studio Loom</div>
          <div className="text-xs text-dust">Agent Console</div>
        </div>

        <nav className="space-y-1">
          <NavButton active={page === 'dashboard'} onClick={() => setPage('dashboard')}>
            Dashboard
          </NavButton>
          <NavButton active={page === 'catalog'} onClick={() => setPage('catalog')}>
            Catalog Admin
          </NavButton>
        </nav>

        <div className="mt-auto flex items-center gap-2 pt-6 text-xs text-dust">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              health === 'ok' ? 'bg-sage' : health === 'error' ? 'bg-rust' : 'animate-pulse bg-thread'
            }`}
          />
          {health === 'ok' ? 'Server connected' : health === 'error' ? 'Server unreachable' : 'Checking...'}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-2xl font-semibold text-linen">{page === 'dashboard' ? 'Dashboard' : 'Catalog Admin'}</h1>
          <p className="mb-6 text-sm text-dust">
            {page === 'dashboard'
              ? 'Trigger the buyer agent and watch the audit trail update live.'
              : 'View and edit products — the demo lever for out-of-stock scenarios.'}
          </p>
          {page === 'dashboard' ? <Dashboard /> : <CatalogAdmin />}
        </div>
      </main>
    </div>
  )
}

export default App

import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ApiStatus, LogoMark, Wordmark } from './components/Brand'
import { ToastProvider } from './components/ui'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import CreateVault from './pages/CreateVault'
import VaultRoom from './pages/VaultRoom'
import Visualize from './pages/Visualize'
import AuditLog from './pages/AuditLog'

const TABS = [
  { to: '/vaults', label: 'Vaults', also: '/vault/' },
  { to: '/create', label: 'New Vault' },
  { to: '/visualize', label: 'Visualize' },
  { to: '/audit', label: 'Audit Log' },
]

function AppShell() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-base/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5" title="Title screen">
            <LogoMark size={32} />
            <Wordmark className="text-lg" />
          </Link>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Sections">
            {TABS.map(({ to, label, also }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    isActive || (also && pathname.startsWith(also)) ? 'bg-sea-400/15 text-sea-200' : 'text-muted hover:bg-white/5 hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <ApiStatus />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <div className="aurora" aria-hidden="true" />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<AppShell />}>
          <Route path="/vaults" element={<Dashboard />} />
          <Route path="/create" element={<CreateVault />} />
          <Route path="/vault/:id" element={<VaultRoom />} />
          <Route path="/visualize" element={<Visualize />} />
          <Route path="/audit" element={<AuditLog />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}

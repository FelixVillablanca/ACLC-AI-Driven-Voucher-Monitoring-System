import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import CompanySwitcher from './CompanySwitcher'
import SidebarUserMenu from './SidebarUserMenu'

/**
 * The shell around every clerk / officer / supervisor page (Framer LolF6YFo5): 240px dark sidebar
 * (brand, the role's menu, the user card) + 64px top bar (company switcher, bell).
 * `nav` = the role's menu (a feature component, passed in by the router, since shared layout code
 * never imports a feature); it gets `onNavigate` to close the phone drawer. `notifications` = the bell.
 * `manageCompaniesSearch` + `overlays` add "Join another company…" to the switcher and its window.
 * Wide screens: the sidebar is always visible. Small screens: ☰ slides it in.
 */
export default function OperationsLayout({ nav: Nav, notifications, onSignOut, manageCompaniesSearch = null, overlays = null }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-muted">
      <div className="hidden shrink-0 lg:block">
        <Sidebar Nav={Nav} onSignOut={onSignOut} />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="relative z-10">
            <Sidebar Nav={Nav} onSignOut={onSignOut} onClose={() => setMenuOpen(false)} />
          </div>
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="flex-1 bg-foreground/40" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
            >
              <Menu className="size-4" aria-hidden="true" />
            </button>
            <CompanySwitcher manageSearch={manageCompaniesSearch} />
          </div>
          <div className="flex items-center gap-3">{notifications}</div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      {/* windows that can open on any page of this area (e.g. Join another company), passed in by the router */}
      {overlays}
    </div>
  )
}

function Sidebar({ Nav, onSignOut, onClose }) {
  const role = useAuthStore((s) => s.user?.role)

  return (
    <aside className="flex h-full w-60 flex-col justify-between bg-sidebar px-3.5 pt-5 pb-4">
      <div className="flex min-h-0 flex-col gap-6">
        <div className="flex items-center justify-between gap-2 px-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              aria-hidden="true"
              className="text-badge flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-primary text-white"
            >
              VM
            </div>
            <p className="truncate text-sm font-semibold text-white">{ROLE_LABELS[role] ?? 'Workspace'}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-on-dark-muted hover:bg-on-dark-surface hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <Nav onNavigate={onClose} />
      </div>
      {/* No account pages for this role yet, so the ⋮ menu shows who you are + Sign out */}
      <SidebarUserMenu onSignOut={onSignOut} links={null} compact={Boolean(onClose)} />
    </aside>
  )
}

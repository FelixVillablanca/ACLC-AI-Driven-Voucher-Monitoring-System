import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from './AdminSidebar'
import AdminTopBar from './AdminTopBar'

/**
 * The admin "shell": sidebar + top bar around every admin page.
 * <Outlet /> is where the current page (dashboard, users, …) is drawn.
 *
 * Wide screens (lg+): the sidebar is always visible.
 * Small screens: it's hidden, and the ☰ button slides it in as a drawer.
 */
export default function AdminLayout({ onSignOut, notifications, overlays }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-muted">
      <div className="hidden shrink-0 lg:block">
        <AdminSidebar onSignOut={onSignOut} />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="relative z-10">
            <AdminSidebar onSignOut={onSignOut} onClose={() => setMenuOpen(false)} />
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="flex-1 bg-foreground/40"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar onOpenMenu={() => setMenuOpen(true)} notifications={notifications} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Feature modals that can open on any admin page (e.g. Create user), passed in by the router */}
      {overlays}
    </div>
  )
}

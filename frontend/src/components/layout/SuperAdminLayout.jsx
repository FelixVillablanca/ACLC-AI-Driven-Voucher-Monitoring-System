import { Outlet } from 'react-router-dom'
import SuperAdminTopNav from './SuperAdminTopNav'

/**
 * The Super Admin "shell" (Framer uH0wO9f5O, redesign v2): NO sidebar, just a white
 * top navigation bar, with the current page drawn below it in <Outlet />.
 *
 * `notifications` (the bell) and `overlays` (modals) come from the router,
 * because shared layout components never import a feature directly.
 */
export default function SuperAdminLayout({ onSignOut, notifications, overlays }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted">
      <SuperAdminTopNav onSignOut={onSignOut} notifications={notifications} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {overlays}
    </div>
  )
}

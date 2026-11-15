import { Navigate, Outlet } from 'react-router-dom'
import { PATHS } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * GUARD #2: "Is your role allowed here?"
 *   <Route element={<RequireRole roles={[ROLES.ADMIN]} />}> ... </Route>
 * Wrong role -> the "no access" page.
 */
export default function RequireRole({ roles }) {
  const role = useAuthStore((s) => s.user?.role)

  if (!roles.includes(role)) return <Navigate to={PATHS.FORBIDDEN} replace />

  return <Outlet />
}

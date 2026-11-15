import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoadingState from '@/components/common/LoadingState'
import { PATHS } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * GUARD #1: "Are you logged in?"
 * No -> send to /login (and remember where they wanted to go).
 * Reminder: guards only improve the experience. The real security is on the backend.
 */
export default function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'unknown') return <LoadingState label="Checking your session…" className="min-h-screen" />
  if (status !== 'authenticated') return <Navigate to={PATHS.LOGIN} replace state={{ from: location }} />

  return <Outlet />
}

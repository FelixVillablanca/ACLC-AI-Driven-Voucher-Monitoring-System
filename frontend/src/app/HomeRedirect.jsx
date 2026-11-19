import { Navigate } from 'react-router-dom'
import SessionErrorScreen from '@/app/SessionErrorScreen'
import LoadingState from '@/components/common/LoadingState'
import { PATHS, ROLE_HOME } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

/** "/" sends each person to THEIR landing page: guests to /login, admin to /admin, clerk to /clerk, … */
export default function HomeRedirect() {
  const { status, user } = useAuthStore()

  if (status === 'unknown') return <LoadingState label="Checking your session…" className="min-h-screen" />
  if (status === 'error') return <SessionErrorScreen />
  if (status !== 'authenticated') return <Navigate to={PATHS.LOGIN} replace />

  return <Navigate to={ROLE_HOME[user.role] ?? PATHS.FORBIDDEN} replace />
}

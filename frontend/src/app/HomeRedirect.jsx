import { Navigate } from 'react-router-dom'
import SessionErrorScreen from '@/app/SessionErrorScreen'
import LoadingState from '@/components/common/LoadingState'
import { PATHS, ROLES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

/** "/" sends each person to the right place: guests to login, admin to /admin, others to /app */
export default function HomeRedirect() {
  const { status, user } = useAuthStore()

  if (status === 'unknown') return <LoadingState label="Checking your session…" className="min-h-screen" />
  if (status === 'error') return <SessionErrorScreen />
  if (status !== 'authenticated') return <Navigate to={PATHS.LOGIN} replace />

  return <Navigate to={user.role === ROLES.ADMIN ? PATHS.ADMIN : PATHS.APP} replace />
}

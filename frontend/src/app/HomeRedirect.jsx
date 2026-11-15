import { Navigate } from 'react-router-dom'
import { PATHS, ROLES } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'

/** "/" sends each person to the right place: guests to login, admin to /admin, others to /app */
export default function HomeRedirect() {
  const { status, user } = useAuthStore()
  if (status !== 'authenticated') return <Navigate to={PATHS.LOGIN} replace />
  return <Navigate to={user.role === ROLES.ADMIN ? PATHS.ADMIN : PATHS.APP} replace />
}

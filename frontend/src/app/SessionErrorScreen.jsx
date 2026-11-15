import ErrorState from '@/components/common/ErrorState'
import { restoreSession } from '@/features/auth'
import { useAuthStore } from '@/stores/useAuthStore'

/** Shown when we couldn't check the login at all (server off, no internet). Offers Retry. */
export default function SessionErrorScreen() {
  const error = useAuthStore((s) => s.error)

  return (
    <ErrorState
      className="min-h-screen"
      title="Can't check your session"
      message={error?.message}
      requestId={error?.requestId}
      onRetry={restoreSession}
    />
  )
}

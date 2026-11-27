import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import { apiClient } from '@/lib/apiClient'

/**
 * TEMPORARY page (until the Login frame is built in Phase 1).
 * It calls GET /api/v1/health and shows the 3 states every screen must have:
 *   Loading -> Error (with Retry) -> Success
 */
export default function SystemStatusPage() {
  const [state, setState] = useState({ status: 'loading' })

  const check = useCallback(
    () =>
      apiClient
        .get('/health')
        .then(({ data }) => setState({ status: 'success', data: data.data }))
        .catch((error) => setState({ status: 'error', error })),
    [],
  )

  useEffect(() => {
    check()
  }, [check])
  
  const retry = () => {
    setState({ status: 'loading' })
    check()
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-page-title">AI-Driven Voucher Monitoring System</h1>
        <p className="text-caption mt-1">Backend connection check:</p>

        <div className="mt-4 rounded-lg border bg-muted">
          {state.status === 'loading' && <LoadingState label="Contacting the backend…" />}

          {state.status === 'error' && (
            <ErrorState
              title="Backend not reachable"
              message={`${state.error.message} (Is "php artisan serve" running in the backend folder?)`}
              requestId={state.error.requestId}
              onRetry={retry}
            />
          )}

          {state.status === 'success' && (
            <div className="flex items-center gap-3 p-5">
              <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
              <div>
                <p className="text-body-strong">Backend connected</p>
                <p className="text-caption">
                  API {state.data.version} · database {state.data.database}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

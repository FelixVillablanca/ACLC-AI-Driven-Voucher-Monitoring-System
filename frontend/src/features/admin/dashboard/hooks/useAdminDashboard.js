import { useCallback, useEffect, useState } from 'react'
import { USERS_CHANGED_EVENT } from '@/features/admin/users'
import { getAdminDashboard } from '../api'

/**
 * Loads the dashboard and tracks its state:
 *   { status: 'loading' | 'success' | 'error', data, error, retry }
 * `retry` is what the "Try again" button calls.
 */
export function useAdminDashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(
    () =>
      getAdminDashboard()
        .then((data) => setState({ status: 'success', data, error: null }))
        .catch((error) => setState({ status: 'error', data: null, error })),
    [],
  )

  useEffect(() => {
    load()
    // A user was created elsewhere (Create user modal): quietly refresh the numbers
    window.addEventListener(USERS_CHANGED_EVENT, load)
    return () => window.removeEventListener(USERS_CHANGED_EVENT, load)
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    load()
  }, [load])

  return { ...state, retry }
}

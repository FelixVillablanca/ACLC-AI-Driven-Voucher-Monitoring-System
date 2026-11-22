import { useCallback, useEffect, useState } from 'react'
import { ACCESS_CHANGED_EVENT } from '@/features/admin/access'
import { DEPARTMENTS_CHANGED_EVENT } from '@/features/admin/departments'
import { USERS_CHANGED_EVENT } from '@/features/admin/users'

// Something was added in a Quick actions modal: quietly refresh the numbers
const REFRESH_EVENTS = [USERS_CHANGED_EVENT, DEPARTMENTS_CHANGED_EVENT, ACCESS_CHANGED_EVENT]
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
    REFRESH_EVENTS.forEach((name) => window.addEventListener(name, load))
    return () => REFRESH_EVENTS.forEach((name) => window.removeEventListener(name, load))
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    load()
  }, [load])

  return { ...state, retry }
}

import { useCallback, useEffect, useState } from 'react'
import { getAdminFormDefaults } from '../api'

/**
 * What the form needs before it can be filled: the Employee ID preview and the companies an Admin
 * can be given. { status: 'loading' | 'success' | 'error', employeeId, companies, error, reload }
 * The companies are REQUIRED, so a failure shows an error state with Retry.
 */
export function useAdminFormDefaults() {
  const [state, setState] = useState({ status: 'loading', employeeId: null, companies: [], error: null })

  // Only sets state when the answer arrives (never straight away inside an effect)
  const fetchDefaults = useCallback(
    () =>
      getAdminFormDefaults()
        .then((d) => setState({ status: 'success', employeeId: d.employee_id, companies: d.companies, error: null }))
        .catch((error) => setState({ status: 'error', employeeId: null, companies: [], error })),
    [],
  )

  useEffect(() => {
    fetchDefaults()
  }, [fetchDefaults])

  // "Try again" / "Create another": show the loading state, then fetch again
  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    fetchDefaults()
  }, [fetchDefaults])

  return { ...state, reload }
}

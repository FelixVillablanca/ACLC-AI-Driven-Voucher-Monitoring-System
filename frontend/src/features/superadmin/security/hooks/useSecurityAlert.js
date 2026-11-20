import { useCallback, useEffect, useState } from 'react'
import { getSecurityAlert } from '../api'

/**
 * One alert for the detail panel: { status, alert, error, reload }.
 * The panel gives this view a new `key` per alert, so it always starts at 'loading'.
 * reload({ quiet: true }) refreshes without blanking the screen (after an action).
 */
export function useSecurityAlert(id) {
  const [state, setState] = useState({ status: 'loading', alert: null, error: null })

  const fetchAlert = useCallback(
    (quiet = false) =>
      getSecurityAlert(id)
        .then((alert) => setState({ status: 'success', alert, error: null }))
        .catch((error) => setState((prev) => (quiet && prev.alert ? prev : { status: 'error', alert: null, error }))),
    [id],
  )

  useEffect(() => {
    fetchAlert()
  }, [fetchAlert])

  const reload = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) setState({ status: 'loading', alert: null, error: null })
      return fetchAlert(quiet)
    },
    [fetchAlert],
  )

  return { ...state, reload }
}

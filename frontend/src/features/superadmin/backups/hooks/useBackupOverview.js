import { useCallback, useEffect, useState } from 'react'
import { getBackupOverview } from '../api'

/** The dialog's facts: { status: 'loading' | 'success' | 'error', overview, error, reload } */
export function useBackupOverview() {
  const [state, setState] = useState({ status: 'loading', overview: null, error: null })

  const fetchOverview = useCallback(
    () =>
      getBackupOverview()
        .then((overview) => setState({ status: 'success', overview, error: null }))
        .catch((error) => setState({ status: 'error', overview: null, error })),
    [],
  )

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const reload = useCallback(() => {
    setState({ status: 'loading', overview: null, error: null })
    return fetchOverview()
  }, [fetchOverview])

  return { ...state, reload }
}

import { useCallback, useEffect, useState } from 'react'
import { listFailedJobs } from '../api'

/** { status: 'loading' | 'success' | 'error', jobs, total, services, error, reload } */
export function useFailedJobs() {
  const [state, setState] = useState({ status: 'loading', jobs: [], total: 0, services: {}, error: null })

  const fetchJobs = useCallback(
    () =>
      listFailedJobs()
        .then(({ jobs, total, services }) => setState({ status: 'success', jobs, total, services, error: null }))
        .catch((error) => setState({ status: 'error', jobs: [], total: 0, services: {}, error })),
    [],
  )

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const reload = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) setState((prev) => ({ ...prev, status: 'loading', error: null }))
      return fetchJobs()
    },
    [fetchJobs],
  )

  return { ...state, reload }
}

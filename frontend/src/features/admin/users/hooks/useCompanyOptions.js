import { useCallback, useEffect, useState } from 'react'
import { getCompanyOptions } from '../api'

/** Loads the companies + departments for the form: { status, companies, error, retry }. */
export function useCompanyOptions() {
  const [state, setState] = useState({ status: 'loading', companies: [], error: null })

  const load = useCallback(
    () =>
      getCompanyOptions()
        .then((companies) => setState({ status: 'success', companies, error: null }))
        .catch((error) => setState({ status: 'error', companies: [], error })),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', companies: [], error: null })
    load()
  }, [load])

  return { ...state, retry }
}

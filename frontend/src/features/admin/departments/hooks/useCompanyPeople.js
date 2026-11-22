import { useCallback, useEffect, useState } from 'react'
import { getCompanyPeople } from '../api'

/** The people who can be a department head: { status, people, error, retry }. Optional field, so a failure only disables it. */
export function useCompanyPeople() {
  const [state, setState] = useState({ status: 'loading', people: [], error: null })

  const load = useCallback(
    () =>
      getCompanyPeople()
        .then((people) => setState({ status: 'success', people, error: null }))
        .catch((error) => setState({ status: 'error', people: [], error })),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', people: [], error: null })
    load()
  }, [load])

  return { ...state, retry }
}

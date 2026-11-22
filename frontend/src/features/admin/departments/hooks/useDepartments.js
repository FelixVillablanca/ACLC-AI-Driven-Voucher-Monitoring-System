import { useCallback, useEffect, useRef, useState } from 'react'
import { listDepartments } from '../api'
import { DEPARTMENTS_CHANGED_EVENT } from '../utils'

/**
 * One page of the Departments list for the current view / search / sort / page.
 *   { status: 'loading' | 'success' | 'error', departments, meta, error, reload }
 * The answer remembers WHICH filters it was for (older answers are ignored), the cards and tab
 * numbers stay visible while the next page loads, and the list refreshes quietly after a change.
 */
export function useDepartments({ view, search, sort, page }) {
  const key = JSON.stringify([view, search, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', departments: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listDepartments({ view, search, sort, page })
        .then(({ departments, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', departments, meta, error: null })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    [key, view, search, sort, page],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(DEPARTMENTS_CHANGED_EVENT, onChanged)
  }, [fetchPage])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    departments: current ? state.departments : [],
    error: current ? state.error : null,
    meta: state.meta,
    reload,
  }
}

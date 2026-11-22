import { useCallback, useEffect, useRef, useState } from 'react'
import { listUsers } from '../api'
import { USERS_CHANGED_EVENT } from '../utils'

/**
 * One page of the Users list for the current filters.
 *   { status: 'loading' | 'success' | 'error', users, meta, error, reload }
 * The answer remembers WHICH filters it was for (older answers are ignored), the cards and tab
 * numbers stay visible while the next page loads, and the list refreshes quietly after any change
 * (create, edit, deactivate…).
 */
export function useUsers({ view, role, department, search, sort, page }) {
  const key = JSON.stringify([view, role, department, search, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', users: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listUsers({ view, role, department, search, sort, page })
        .then(({ users, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', users, meta, error: null })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    [key, view, role, department, search, sort, page],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(USERS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(USERS_CHANGED_EVENT, onChanged)
  }, [fetchPage])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    users: current ? state.users : [],
    error: current ? state.error : null,
    meta: state.meta,
    reload,
  }
}

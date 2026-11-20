import { useCallback, useEffect, useRef, useState } from 'react'
import { listAdmins } from '../api'
import { ADMINS_CHANGED_EVENT } from '../utils'

/**
 * One page of the Admin accounts table for the current filters.
 *   { status: 'loading' | 'success' | 'error', accounts, meta, error, reload }
 *
 * The saved answer remembers WHICH filters it was for, so changing a filter shows
 * "loading" on its own. Older, slower answers are ignored (request id).
 * Refreshes quietly when an Admin is created / locked / unlocked anywhere in the app.
 */
export function useAdminAccounts({ status, role, search, page }) {
  const key = JSON.stringify([status, role, search, page])
  const [state, setState] = useState({ key: null, status: 'loading', accounts: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listAdmins({ status, role, search, page })
        .then(({ accounts, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', accounts, meta, error: null })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    [key, status, role, search, page],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(ADMINS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(ADMINS_CHANGED_EVENT, onChanged)
  }, [fetchPage])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    accounts: current ? state.accounts : [],
    error: current ? state.error : null,
    meta: state.meta, // chip counts + subtitle stay visible while the next page loads
    reload,
  }
}

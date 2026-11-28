import { useCallback, useEffect, useRef, useState } from 'react'
import { COMPANIES_CHANGED_EVENT } from '@/features/superadmin/companies'
import { listAdmins } from '../api'
import { ADMINS_CHANGED_EVENT } from '../utils'

/**
 * One page of the Admins table for the current view / search / sort.
 *   { status: 'loading' | 'success' | 'error', accounts, meta, error, reload }
 *
 * The saved answer remembers WHICH filters it was for, so changing a filter shows
 * "loading" on its own. Older, slower answers are ignored (request id).
 * Refreshes quietly when an account is created / changed anywhere in the app.
 */
export function useAdminAccounts({ view, search, sort, order, page }) {
  const key = JSON.stringify([view, search, sort, order, page])
  const [state, setState] = useState({ key: null, status: 'loading', accounts: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listAdmins({ view, search, sort, order, page })
        .then(({ accounts, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', accounts, meta, error: null })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    [key, view, search, sort, order, page],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(ADMINS_CHANGED_EVENT, onChanged)
    // + Add company may have given an Admin with no company their company
    window.addEventListener(COMPANIES_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(ADMINS_CHANGED_EVENT, onChanged)
      window.removeEventListener(COMPANIES_CHANGED_EVENT, onChanged)
    }
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
    meta: state.meta, // the cards and tab numbers stay visible while the next page loads
    reload,
  }
}

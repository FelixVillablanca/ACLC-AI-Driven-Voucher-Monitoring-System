import { useCallback, useEffect, useRef, useState } from 'react'
import { listCompanies } from '../api'
import { COMPANIES_CHANGED_EVENT } from '../utils'

/**
 * One page of the Companies tab for the current view / search / sort.
 *   { status: 'loading' | 'success' | 'error', companies, meta, error, reload }
 *
 * Same pattern as useAdminAccounts: the saved answer remembers WHICH filters it was for, older and
 * slower answers are ignored, and the list refreshes quietly after a suspend / reactivate.
 */
export function useCompanies({ view, search, sort, suspendedFirst, page }) {
  const key = JSON.stringify([view, search, sort, suspendedFirst, page])
  const [state, setState] = useState({ key: null, status: 'loading', companies: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listCompanies({ view, search, sort, suspendedFirst, page })
        .then(({ companies, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', companies, meta, error: null })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    [key, view, search, sort, suspendedFirst, page],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(COMPANIES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(COMPANIES_CHANGED_EVENT, onChanged)
  }, [fetchPage])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    companies: current ? state.companies : [],
    error: current ? state.error : null,
    meta: state.meta, // the cards and tab numbers stay visible while the next page loads
    reload,
  }
}

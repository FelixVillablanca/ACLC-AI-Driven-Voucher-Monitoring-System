import { useCallback, useEffect, useRef, useState } from 'react'
import { listCompanyAccess } from '../api'
import { ACCESS_CHANGED_EVENT } from '../utils'

/**
 * One page of the Company access list for the current view / search / sort / page.
 *   { status: 'loading' | 'success' | 'error', people, meta, error, reload }
 * Older answers are ignored, the cards stay visible while the next page loads, and the list
 * refreshes quietly after a grant or a removal.
 */
export function useCompanyAccess({ view, search, sort, page }) {
  const key = JSON.stringify([view, search, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', people: [], meta: null, error: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listCompanyAccess({ view, search, sort, page })
        .then(({ people, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', people, meta, error: null })
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
    window.addEventListener(ACCESS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(ACCESS_CHANGED_EVENT, onChanged)
  }, [fetchPage])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    people: current ? state.people : [],
    error: current ? state.error : null,
    meta: state.meta,
    reload,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { listSecurityAlerts } from '../api'

const NOT_LOADED = Symbol('not loaded')

/**
 * The alert list for one tab.
 *   { status: 'loading' | 'success' | 'error', alerts, counts, error,
 *     hasMore, loadingMore, loadMore, reload }
 *
 * "Load more" uses the server's CURSOR (a bookmark that says "after this alert"),
 * so new alerts arriving at the top never make you see one twice.
 *
 * The saved answer remembers WHICH tab it belongs to. Switching tabs therefore shows
 * "loading" by itself, and a request id stops an old, slow answer from overwriting a newer tab.
 */
export function useSecurityAlerts(statusFilter) {
  const [state, setState] = useState({ forFilter: NOT_LOADED, status: 'loading', alerts: [], counts: null, error: null, nextCursor: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const requestRef = useRef(0)

  /** Ask the server. quiet = keep what's on screen if it fails (a refresh after an action). */
  const fetchFirstPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listSecurityAlerts({ status: statusFilter })
        .then(({ alerts, nextCursor, counts }) => {
          if (id === requestRef.current) {
            setState({ forFilter: statusFilter, status: 'success', alerts, counts, error: null, nextCursor })
          }
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, forFilter: statusFilter, status: 'error', error }))
        })
    },
    [statusFilter],
  )

  useEffect(() => {
    fetchFirstPage()
  }, [fetchFirstPage])

  const reload = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) setState((prev) => ({ ...prev, forFilter: NOT_LOADED, error: null }))
      return fetchFirstPage(quiet)
    },
    [fetchFirstPage],
  )

  const loadMore = useCallback(async () => {
    if (!state.nextCursor || loadingMore) return
    const id = requestRef.current
    setLoadingMore(true)
    try {
      const page = await listSecurityAlerts({ status: statusFilter, cursor: state.nextCursor })
      if (id === requestRef.current) {
        setState((prev) => ({ ...prev, alerts: [...prev.alerts, ...page.alerts], nextCursor: page.nextCursor, counts: page.counts }))
      }
    } finally {
      setLoadingMore(false)
    }
  }, [state.nextCursor, loadingMore, statusFilter])

  const current = state.forFilter === statusFilter
  return {
    status: current ? state.status : 'loading',
    alerts: current ? state.alerts : [],
    error: current ? state.error : null,
    counts: state.counts, // the tab numbers stay visible while another tab loads
    hasMore: current && Boolean(state.nextCursor),
    loadingMore,
    loadMore,
    reload,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { listAuditLogs } from '../api'
import { AUDIT_CHANGED_EVENT } from '../utils'

/** How often the first page refreshes by itself ("● Live · updated just now"). */
const LIVE_EVERY_MS = 30_000

/**
 * One page of the Audit logs table for the current filters.
 *   { status, entries, meta, error, updatedAt, reload }
 *
 * LIVE: while you're on page 1 and the tab is visible, it quietly fetches again every 30 s, marked as
 * a background request so it doesn't keep a Super Admin's session awake (idle timeout).
 * Older and slower answers are ignored (requestRef), like the other tables.
 */
export function useAuditLogs(filters, page) {
  const key = JSON.stringify([filters, page])
  const [state, setState] = useState({ key: null, status: 'loading', entries: [], meta: null, error: null, updatedAt: null })
  const requestRef = useRef(0)

  const fetchPage = useCallback(
    (quiet = false) => {
      const id = ++requestRef.current
      return listAuditLogs(filters, page, { background: quiet })
        .then(({ entries, meta }) => {
          if (id === requestRef.current) setState({ key, status: 'success', entries, meta, error: null, updatedAt: Date.now() })
        })
        .catch((error) => {
          if (id !== requestRef.current) return
          setState((prev) => (quiet && prev.status === 'success' ? prev : { ...prev, key, status: 'error', error }))
        })
    },
    // filters is re-created from the address on each render; `key` is its stable fingerprint
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    window.addEventListener(AUDIT_CHANGED_EVENT, onChanged)
    const timer =
      page === 1
        ? window.setInterval(() => document.visibilityState === 'visible' && fetchPage(true), LIVE_EVERY_MS)
        : null
    return () => {
      window.removeEventListener(AUDIT_CHANGED_EVENT, onChanged)
      if (timer) window.clearInterval(timer)
    }
  }, [fetchPage, page])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, key: null }))
    return fetchPage()
  }, [fetchPage])

  const current = state.key === key
  return {
    status: current ? state.status : 'loading',
    entries: current ? state.entries : [],
    error: current ? state.error : null,
    meta: state.meta, // the cards and filter counts stay visible while the next answer loads
    updatedAt: state.updatedAt,
    reload,
  }
}

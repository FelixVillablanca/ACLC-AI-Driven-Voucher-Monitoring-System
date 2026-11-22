import { useCallback, useEffect, useState } from 'react'
import { listAuditLogs } from '../api'

/**
 * One page of the audit log for the current filters: { status, entries, meta, error, reload }.
 * The answer is saved with the filters it's for (an older, slower answer is thrown away), and the
 * cards stay on screen while the next page loads.
 */
export function useAuditLogs(filters) {
  const key = JSON.stringify(filters)
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState({ key: null, status: 'loading', entries: [], meta: null, error: null })
  const fullKey = `${key}|${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    listAuditLogs({ ...JSON.parse(key), signal: controller.signal })
      .then(({ entries, meta }) => setAnswer({ key: fullKey, status: 'success', entries, meta, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setAnswer((prev) => ({ ...prev, key: fullKey, status: 'error', entries: [], error }))
      })
    return () => controller.abort()
  }, [key, fullKey])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const current = answer.key === fullKey
  return {
    status: current ? answer.status : 'loading',
    entries: current ? answer.entries : [],
    error: current ? answer.error : null,
    meta: answer.meta,
    reload,
  }
}

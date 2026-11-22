import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { getMyCompanyAccess } from '../api'

/**
 * Everything in the Join another company window: { status, data, error, reload }.
 * `searchText` narrows "Ask to join" (asked again 300 ms after typing stops).
 */
export function useMyCompanyAccess(searchText) {
  const search = useDebounce(searchText.trim(), 300)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const key = `${search}|${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    getMyCompanyAccess({ search, signal: controller.signal })
      .then((data) => setState({ key, status: 'success', data, error: null }))
      .catch((error) => !controller.signal.aborted && setState((prev) => ({ ...prev, key, status: 'error', error })))
    return () => controller.abort()
  }, [search, key])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  // keep showing the last answer while a new search loads (only the first load shows a spinner)
  const current = state.key === key
  return {
    status: current ? state.status : state.data ? 'success' : 'loading',
    data: state.data,
    error: current ? state.error : null,
    reload,
  }
}

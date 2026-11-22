import { useCallback, useEffect, useState } from 'react'
import { getPendingAccess } from '../api'
import { ACCESS_CHANGED_EVENT } from '../utils'

/**
 * The Requests tab: people asking to join + the invitations you sent.
 *   { status, requests, invites, error, reload }   (refreshes quietly after any access change)
 */
export function usePendingAccess() {
  const [state, setState] = useState({ status: 'loading', requests: [], invites: [], error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      getPendingAccess()
        .then(({ requests, invites }) => alive && setState({ status: 'success', requests, invites, error: null }))
        .catch((error) => alive && !quiet && setState({ status: 'error', requests: [], invites: [], error }))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(ACCESS_CHANGED_EVENT, onChanged)
    return () => {
      alive = false
      window.removeEventListener(ACCESS_CHANGED_EVENT, onChanged)
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading', requests: [], invites: [], error: null })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, reload }
}

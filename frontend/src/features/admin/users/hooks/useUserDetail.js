import { useCallback, useEffect, useState } from 'react'
import { getUser } from '../api'
import { USERS_CHANGED_EVENT } from '../utils'

/**
 * The person in the side panel: { status, user, error, reload }.
 * The answer is saved with the id it's for (a quick switch never shows the wrong person),
 * and it refreshes quietly after an edit / deactivate.
 */
export function useUserDetail(id) {
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${attempt}`
  const [state, setState] = useState({ key: null, status: 'loading', user: null, error: null })

  useEffect(() => {
    if (!id) return undefined
    let alive = true
    const load = () =>
      getUser(id)
        .then((user) => alive && setState({ key, status: 'success', user, error: null }))
        .catch(
          (error) =>
            alive &&
            setState((prev) => (prev.key === key && prev.status === 'success' ? prev : { key, status: 'error', user: null, error })),
        )
    load()
    window.addEventListener(USERS_CHANGED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(USERS_CHANGED_EVENT, load)
    }
  }, [id, key])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const current = state.key === key
  return { status: current ? state.status : 'loading', user: current ? state.user : null, error: current ? state.error : null, reload }
}

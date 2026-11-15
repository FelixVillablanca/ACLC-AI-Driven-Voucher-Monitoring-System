import { useEffect } from 'react'
import { restoreSession } from '../utils'

/** Runs ONCE when the app opens: restores the login from the session cookie. */
export function useSessionCheck() {
  useEffect(() => {
    restoreSession()
  }, [])
}

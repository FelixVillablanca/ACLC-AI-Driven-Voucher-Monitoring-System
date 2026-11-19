import { useCallback, useEffect, useState } from 'react'
import { getUnreadCount } from '../api'

const REFRESH_EVERY_MS = 60_000 // once a minute

/**
 * The number on the bell. It refreshes:
 *   - when the page opens
 *   - every minute ("polling")
 *   - when you come back to this browser tab
 * A failed refresh keeps the last number quietly. The bell isn't worth an error
 * message every minute, and the panel itself shows errors when opened.
 */
export function useUnreadCount() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(
    () =>
      getUnreadCount()
        .then(setCount)
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, REFRESH_EVERY_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { count, setCount, refresh }
}

import { useCallback, useEffect, useState } from 'react'
import { getUnreadCount } from '../api'
import { NOTIFICATIONS_CHANGED_EVENT } from '../utils'

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
    (background = false) =>
      getUnreadCount({ background })
        .then(setCount)
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    refresh()
    const timer = setInterval(() => refresh(true), REFRESH_EVERY_MS) // timer = background
    const onFocus = () => refresh(true)
    const onChanged = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged) // marked read on the All notifications page
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    }
  }, [refresh])

  return { count, setCount, refresh }
}

import { useCallback, useEffect, useState } from 'react'
import { ADMINS_CHANGED_EVENT } from '@/features/superadmin/admins'
import { getSuperAdminDashboard } from '../api'

/** The Services panel is "checked every 60 seconds" (Framer m80KDanOj), so the page refreshes itself that often. */
const REFRESH_EVERY_MS = 60_000

/**
 * Loads the Super Admin dashboard and keeps it fresh.
 *   { status: 'loading' | 'success' | 'error', data, error, refreshFailed, retry }
 *
 * POLLING = asking the server again on a timer. A failed BACKGROUND refresh doesn't
 * wipe the screen: the last good numbers stay, and `refreshFailed` lets the page say
 * "couldn't refresh". Only the first load shows the full error state.
 * The timer pauses while the browser tab is hidden (no point asking when nobody looks).
 */
export function useSuperAdminDashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null, refreshFailed: false })

  const load = useCallback(
    (background = false) =>
      getSuperAdminDashboard({ background })
        .then((data) => setState({ status: 'success', data, error: null, refreshFailed: false }))
        .catch((error) =>
          setState((prev) =>
            prev.data ? { ...prev, refreshFailed: true } : { status: 'error', data: null, error, refreshFailed: false },
          ),
        ),
    [],
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => document.visibilityState === 'visible' && load(true), REFRESH_EVERY_MS)
    // An Admin was just created (Create admin modal): refresh the numbers right away
    const onAdminsChanged = () => load()
    window.addEventListener(ADMINS_CHANGED_EVENT, onAdminsChanged)
    return () => {
      clearInterval(timer)
      window.removeEventListener(ADMINS_CHANGED_EVENT, onAdminsChanged)
    }
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: null, refreshFailed: false })
    load()
  }, [load])

  return { ...state, retry }
}

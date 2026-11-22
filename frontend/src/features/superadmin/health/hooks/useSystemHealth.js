import { useCallback, useEffect, useState } from 'react'
import { AUDIT_CHANGED_EVENT } from '@/features/superadmin/audit'
import { BACKUPS_CHANGED_EVENT } from '@/features/superadmin/backups'
import { JOBS_CHANGED_EVENT } from '@/features/superadmin/jobs'
import { checkNow, getSystemHealth } from '../api'
import { HEALTH_CHANGED_EVENT } from '../utils'

/** The page asks again every 60 seconds ("Checked every 60 seconds"), like the scheduler. */
const REFRESH_MS = 60_000

/**
 * The System health page's data.
 *   { status, data, error, checking, reload, check }
 * check() = SH1 "Check now": every service checked right now; the cards show "Checking…" meanwhile.
 * It also refreshes after a backup, a retry, a block/unblock or a resolved incident (events).
 */
export function useSystemHealth() {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  })
  const [checking, setChecking] = useState(false)

  const fetchPage = useCallback(
    (quiet = false) =>
      getSystemHealth({ background: quiet })
        .then((data) => setState({ status: 'success', data, error: null }))
        .catch((error) => setState((prev) => (quiet && prev.data ? prev : { status: 'error', data: null, error }))),
    [],
  )

  useEffect(() => {
    fetchPage()
    const onChanged = () => fetchPage(true)
    const events = [HEALTH_CHANGED_EVENT, BACKUPS_CHANGED_EVENT, JOBS_CHANGED_EVENT, AUDIT_CHANGED_EVENT]
    events.forEach((e) => window.addEventListener(e, onChanged))
    const timer = window.setInterval(() => document.visibilityState === 'visible' && fetchPage(true), REFRESH_MS)
    return () => {
      events.forEach((e) => window.removeEventListener(e, onChanged))
      window.clearInterval(timer)
    }
  }, [fetchPage])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    return fetchPage()
  }, [fetchPage])

  /** Returns true when it worked; the caller shows the error otherwise. */
  const check = useCallback(async () => {
    setChecking(true)
    try {
      const data = await checkNow()
      setState({ status: 'success', data, error: null })
      return { ok: true, data }
    } catch (error) {
      return { ok: false, error }
    } finally {
      setChecking(false)
    }
  }, [])

  return { ...state, checking, reload, check }
}

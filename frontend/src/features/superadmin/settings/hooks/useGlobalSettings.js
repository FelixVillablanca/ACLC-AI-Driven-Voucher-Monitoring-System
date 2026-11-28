import { useCallback, useEffect, useState } from 'react'
import { getGlobalSettings } from '../api'

/**
 * The SAVED global settings + the facts shown next to them.
 *   { status, values, context, error, reload, refresh, replace }
 * reload()  = show the loading state and fetch again (after an error)
 * refresh() = fetch quietly, keeping the page on screen (after "someone else saved first")
 * replace() = use the values a successful save sent back (no extra request)
 */
export function useGlobalSettings() {
  const [state, setState] = useState({ status: 'loading', values: null, context: null, error: null })

  const fetchSettings = useCallback(
    (quiet = false) =>
      getGlobalSettings()
        .then(({ values, context }) => setState({ status: 'success', values, context, error: null }))
        .catch((error) => setState((prev) => (quiet && prev.values ? prev : { status: 'error', values: null, context: null, error }))),
    [],
  )

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const reload = useCallback(() => {
    setState({ status: 'loading', values: null, context: null, error: null })
    return fetchSettings()
  }, [fetchSettings])

  const refresh = useCallback(() => fetchSettings(true), [fetchSettings])

  const replace = useCallback(
    (values, lastSaved) => setState((prev) => ({ ...prev, values, context: { ...prev.context, last_saved: lastSaved } })),
    [],
  )

  return { ...state, reload, refresh, replace }
}

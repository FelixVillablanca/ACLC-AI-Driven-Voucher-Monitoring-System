import { useCallback, useEffect, useState } from 'react'
import { getCatalog } from '../api'
import { CATALOG_CHANGED_EVENT } from '../utils'

/**
 * The 3 lists of the Categories page: { status, lists: { categories, voucher_types, payee_types }, error, reload }.
 * The lists are small, so they're loaded together once; search happens in the browser.
 * After a change it refreshes quietly (the old lists stay on screen meanwhile).
 */
export function useCatalog() {
  const [state, setState] = useState({ status: 'loading', lists: null, error: null })

  const load = useCallback(
    (quiet = false) =>
      getCatalog()
        .then((lists) => setState({ status: 'success', lists, error: null }))
        .catch((error) => setState((prev) => (quiet && prev.status === 'success' ? prev : { status: 'error', lists: null, error }))),
    [],
  )

  useEffect(() => {
    load()
    const onChanged = () => load(true)
    window.addEventListener(CATALOG_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CATALOG_CHANGED_EVENT, onChanged)
  }, [load])

  const reload = useCallback(() => {
    setState({ status: 'loading', lists: null, error: null })
    load()
  }, [load])

  return { ...state, reload }
}

import { useCallback, useEffect, useState } from 'react'
import { getAdmin } from '../api'
import { ADMINS_CHANGED_EVENT } from '../utils'

/**
 * One account for the profile panel and the Edit / Make Super Admin dialogs.
 *   { status, account, error, reload }   (refreshes quietly after any account change)
 * The caller gives the view a new `key` per account, so it always starts at 'loading'.
 */
export function useAdminDetail(id) {
  const [state, setState] = useState({ status: 'loading', account: null, error: null })

  const fetchAccount = useCallback(
    (quiet = false) =>
      getAdmin(id)
        .then((account) => setState({ status: 'success', account, error: null }))
        .catch((error) => setState((prev) => (quiet && prev.account ? prev : { status: 'error', account: null, error }))),
    [id],
  )

  useEffect(() => {
    fetchAccount()
    const onChanged = () => fetchAccount(true)
    window.addEventListener(ADMINS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(ADMINS_CHANGED_EVENT, onChanged)
  }, [fetchAccount])

  const reload = useCallback(() => {
    setState({ status: 'loading', account: null, error: null })
    return fetchAccount()
  }, [fetchAccount])

  return { ...state, reload }
}

import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getAccount } from '../api'

/**
 * The signed-in person's own account (GET /account).
 *   { status: 'loading'|'success'|'error', data, error, reload, replace }
 * replace(account) = use the fresh copy a save sent back. It also updates the name in the
 * top bar / sidebar (useAuthStore), so the whole app shows the new name at once.
 */
export function useAccount() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(
    () =>
      getAccount()
        .then((data) => setState({ status: 'success', data, error: null }))
        .catch((error) => setState({ status: 'error', data: null, error })),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    return load()
  }, [load])

  const replace = useCallback((account) => {
    setState({ status: 'success', data: account, error: null })
    const { user, setUser } = useAuthStore.getState()
    if (user) {
      setUser({
        ...user,
        first_name: account.first_name,
        last_name: account.last_name,
        full_name: account.full_name,
        personal_email: account.personal_email,
      })
    }
  }, [])

  return { ...state, reload, replace }
}

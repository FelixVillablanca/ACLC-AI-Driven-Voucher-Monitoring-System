import { useCallback, useEffect, useState } from 'react'
import { getCompany } from '../api'
import { COMPANIES_CHANGED_EVENT } from '../utils'

/**
 * One company for the side panel (C8).
 *   { status, company, error, reload }   (refreshes quietly after a suspend / reactivate)
 * The panel gets a new `key` per company, so it always starts at 'loading'.
 */
export function useCompanyDetail(id) {
  const [state, setState] = useState({ status: 'loading', company: null, error: null })

  const fetchCompany = useCallback(
    (quiet = false) =>
      getCompany(id)
        .then((company) => setState({ status: 'success', company, error: null }))
        .catch((error) =>
          setState((prev) => (quiet && prev.company ? prev : { status: 'error', company: null, error })),
        ),
    [id],
  )

  useEffect(() => {
    fetchCompany()
    const onChanged = () => fetchCompany(true)
    window.addEventListener(COMPANIES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(COMPANIES_CHANGED_EVENT, onChanged)
  }, [fetchCompany])

  const reload = useCallback(() => {
    setState({ status: 'loading', company: null, error: null })
    return fetchCompany()
  }, [fetchCompany])

  return { ...state, reload }
}

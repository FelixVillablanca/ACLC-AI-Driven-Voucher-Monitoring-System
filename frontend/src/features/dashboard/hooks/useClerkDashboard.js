import { useEffect } from 'react'
import { create } from 'zustand'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getClerkDashboard } from '../api'

/**
 * The clerk dashboard data, SHARED by the sidebar (the counts next to My vouchers, Drafts, Returned)
 * and the page, so it's asked for once, not twice. Saved per company: switching company loads that
 * company's numbers, and an answer for the old company that arrives late is thrown away.
 */
const useStore = create((set, get) => ({
  companyId: null,
  status: 'loading',
  data: null,
  error: null,
  load: (companyId, { quiet = false } = {}) => {
    if (!quiet) set({ companyId, status: 'loading', data: null, error: null })
    getClerkDashboard()
      .then((data) => get().companyId === companyId && set({ status: 'success', data, error: null }))
      .catch((error) => get().companyId === companyId && !quiet && set({ status: 'error', data: null, error }))
  },
}))

export function useClerkDashboard() {
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const state = useStore()

  useEffect(() => {
    if (companyId && useStore.getState().companyId !== companyId) useStore.getState().load(companyId)
  }, [companyId])

  const current = state.companyId === companyId
  return {
    status: current ? state.status : 'loading',
    data: current ? state.data : null,
    error: current ? state.error : null,
    retry: () => useStore.getState().load(companyId),
  }
}

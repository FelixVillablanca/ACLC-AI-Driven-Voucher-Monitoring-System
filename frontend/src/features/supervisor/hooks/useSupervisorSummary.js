import { useEffect } from 'react'
import { create } from 'zustand'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getSupervisorSummary } from '../api'
import { DECISIONS_CHANGED_EVENT } from '../utils'

/**
 * The Supervisor's summary (queue counts, today's decisions), SHARED by the sidebar and the queue page, asked for
 * once per company. Refreshes quietly after a decision and every 60 s (Accounting keeps forwarding vouchers).
 */
const useStore = create((set, get) => ({
  companyId: null,
  status: 'loading',
  data: null,
  error: null,
  load: (companyId, { quiet = false } = {}) => {
    if (!quiet) set({ companyId, status: 'loading', data: null, error: null })
    getSupervisorSummary({ background: quiet })
      .then((data) => get().companyId === companyId && set({ status: 'success', data, error: null }))
      .catch((error) => get().companyId === companyId && !quiet && set({ status: 'error', data: null, error }))
  },
}))

export function useSupervisorSummary() {
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const state = useStore()

  useEffect(() => {
    if (companyId && useStore.getState().companyId !== companyId) useStore.getState().load(companyId)
    const refresh = () => companyId && useStore.getState().load(companyId, { quiet: true })
    window.addEventListener(DECISIONS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener(DECISIONS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
  }, [companyId])

  const current = state.companyId === companyId
  return { status: current ? state.status : 'loading', data: current ? state.data : null, error: current ? state.error : null }
}

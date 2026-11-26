import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_HOME } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

/**
 * Switch the company you work in AND go back to your dashboard (user rule 2026-11-26).
 * The page you were on belonged to the old company (a voucher, a payee, a filtered list), so staying
 * there would show "not found" or the wrong list. Used by the "Working in" menu and by "Switch" after
 * accepting an invitation. Returns false when it's already the active company (nothing happens).
 */
export function useSwitchCompany() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)

  return useCallback(
    (companyId) => {
      const { activeCompanyId, setActiveCompany } = useCompanyStore.getState()
      if (companyId === activeCompanyId) return false
      setActiveCompany(companyId)
      navigate(ROLE_HOME[role] ?? '/', { replace: false })
      return true
    },
    [navigate, role],
  )
}

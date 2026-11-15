import { Outlet } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

/**
 * GUARD #3: "Have you picked a company?"
 * Clerks, officers and supervisors always work inside ONE company at a time.
 * After login a company is picked automatically (features/auth/utils.js);
 * the company switcher comes with its Framer frame.
 */
export default function RequireCompany() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const hasCompanies = useAuthStore((s) => (s.user?.companies?.length ?? 0) > 0)

  if (!activeCompanyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Building2}
          title={hasCompanies ? 'Select a company to continue' : 'No company access yet'}
          description={
            hasCompanies
              ? 'Choose which company you want to work in.'
              : 'Your account has not been given access to any company. Please contact your system administrator.'
          }
        />
      </div>
    )
  }

  return <Outlet />
}

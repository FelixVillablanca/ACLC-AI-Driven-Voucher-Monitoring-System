import { Outlet } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { useCompanyStore } from '@/stores/useCompanyStore'

/**
 * GUARD #3: "Have you picked a company?"
 * Clerks, officers and supervisors always work inside ONE company at a time.
 * The company picker itself is built in Phase 1 (from the Framer design).
 */
export default function RequireCompany() {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)

  if (!activeCompanyId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          icon={Building2}
          title="Select a company to continue"
          description="Choose which company you want to work in."
        />
      </div>
    )
  }

  return <Outlet />
}

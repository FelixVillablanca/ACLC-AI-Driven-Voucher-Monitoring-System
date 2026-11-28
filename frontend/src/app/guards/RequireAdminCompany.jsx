import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import LoadingState from '@/components/common/LoadingState'
import { useAuthStore } from '@/stores/useAuthStore'

const NoCompanyYetPage = lazy(() => import('@/features/admin/noCompany').then((m) => ({ default: m.NoCompanyYetPage })))

/**
 * GUARD: "Does this Admin have a company yet?" (since 2026-11-28 an Admin may be created with "No company yet").
 * Around the Admin console pages only; their account pages and notifications stay open.
 * UX only: the server refuses /api/v1/admin/* with 403 NO_COMPANY_YET anyway.
 */
export default function RequireAdminCompany() {
  const hasCompany = useAuthStore((s) => !!s.user?.company)

  if (hasCompany) return <Outlet />

  return (
    <Suspense fallback={<LoadingState />}>
      <NoCompanyYetPage />
    </Suspense>
  )
}

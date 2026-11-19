import { ArrowLeftRight, Building2, Layers, Users } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { formatDate } from '@/lib/formatters'
import { useAuthStore } from '@/stores/useAuthStore'
import DashboardSkeleton from '../components/DashboardSkeleton'
import NeedsAttentionCard from '../components/NeedsAttentionCard'
import QuickActionsCard from '../components/QuickActionsCard'
import RecentActivityCard from '../components/RecentActivityCard'
import StatCard from '../components/StatCard'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { greeting, plural } from '../utils'

/**
 * ADMIN LANDING PAGE: Framer "Admin UI Landing Page" (node Nhw7N27tM).
 * Real numbers from GET /api/v1/admin/dashboard, with Loading / Error / Empty states.
 */
export default function AdminDashboardPage() {
  const firstName = useAuthStore((s) => s.user?.first_name)
  const { status, data, error, retry } = useAdminDashboard()

  return (
    <div className="@container flex flex-col gap-5 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-body text-muted-foreground">Here&apos;s an overview of your system setup across all companies.</p>
        </div>
        <p className="text-caption">{formatDate(new Date())}</p>
      </div>

      {status === 'loading' && <DashboardSkeleton />}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the dashboard"
            message={error.message}
            requestId={error.requestId}
            onRetry={retry}
          />
        </div>
      )}

      {status === 'success' && <DashboardContent data={data} />}
    </div>
  )
}

function DashboardContent({ data }) {
  const { companies, departments, users, company_access: access } = data

  return (
    <>
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-4">
        <StatCard
          label="Companies"
          icon={Building2}
          value={companies.total}
          pill={{ tone: 'success', text: `${companies.active} active` }}
          caption={`${companies.inactive} inactive`}
        />
        <StatCard
          label="Departments"
          icon={Layers}
          value={departments.total}
          pill={
            departments.total === 0
              ? null
              : departments.without_head > 0
                ? { tone: 'warning', text: `${departments.without_head} no head` }
                : { tone: 'success', text: 'All have heads' }
          }
          caption={
            departments.total === 0 ? 'None created yet' : `across ${plural(departments.companies, 'company', 'companies')}`
          }
        />
        <StatCard
          label="Users"
          icon={Users}
          value={users.total}
          pill={{ tone: 'success', text: `+${users.added_this_month}` }}
          caption="added this month"
        />
        <StatCard
          label="Company Access"
          icon={ArrowLeftRight}
          value={access.total}
          pill={
            access.users_without_access > 0
              ? { tone: 'warning', text: plural(access.users_without_access, 'user', 'users') }
              : { tone: 'success', text: 'All users' }
          }
          caption={access.users_without_access > 0 ? 'without access' : 'have access'}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <RecentActivityCard items={data.recent_activity} />
        <div className="flex w-full flex-col gap-4 lg:w-[300px] lg:shrink-0">
          <QuickActionsCard />
          <NeedsAttentionCard items={data.needs_attention} />
        </div>
      </div>
    </>
  )
}

import ErrorState from '@/components/common/ErrorState'
import { formatNumber, plural } from '@/lib/formatters'
import { useAuthStore } from '@/stores/useAuthStore'
import AdminAccountsCard from '../components/AdminAccountsCard'
import AttentionCard from '../components/AttentionCard'
import GlobalRulesCard from '../components/GlobalRulesCard'
import KpiTile from '../components/KpiTile'
import SuperAdminDashboardSkeleton from '../components/SuperAdminDashboardSkeleton'
import WelcomeBanner from '../components/WelcomeBanner'
import { useSuperAdminDashboard } from '../hooks/useSuperAdminDashboard'

/**
 * SUPER ADMIN LANDING PAGE: Framer "Super Admin landing page, redesign v2" (node uH0wO9f5O).
 * Real numbers from GET /api/v1/superadmin/dashboard, refreshed every minute,
 * with Loading / Error / Empty states. No voucher or money data, by design.
 */
export default function SuperAdminDashboardPage() {
  const firstName = useAuthStore((s) => s.user?.first_name)
  const { status, data, error, refreshFailed, retry } = useSuperAdminDashboard()

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-7">
      {status === 'loading' && <SuperAdminDashboardSkeleton />}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState title="Couldn't load the overview" message={error.message} requestId={error.requestId} onRetry={retry} />
        </div>
      )}

      {status === 'success' && <Overview data={data} firstName={firstName} refreshFailed={refreshFailed} />}
    </div>
  )
}

function Overview({ data, firstName, refreshFailed }) {
  const { admins, super_admins: owners, companies, users } = data.counts
  const seatsLeft = owners.seats - owners.active

  return (
    <>
      <WelcomeBanner
        firstName={firstName}
        attentionCount={data.attention.length}
        companies={companies.total}
        services={data.services}
        checkedAt={data.checked_at}
        refreshFailed={refreshFailed}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          value={formatNumber(admins.total)}
          label="Admin accounts"
          caption={`${admins.active} active · ${admins.inactive} deactivated`}
        />
        <KpiTile
          value={`${owners.active}/${owners.seats}`}
          label="Super admins"
          caption={seatsLeft > 0 ? `${plural(seatsLeft, 'seat', 'seats')} left` : 'All seats taken'}
        />
        <KpiTile
          value={formatNumber(companies.total)}
          label="Companies"
          caption={`${companies.active} active · ${companies.suspended} suspended`}
        />
        <KpiTile value={formatNumber(users.total)} label="Users" caption="across all companies" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <AttentionCard items={data.attention} />
        <AdminAccountsCard admins={data.admins} />
      </div>

      <GlobalRulesCard rules={data.rules} />
    </>
  )
}

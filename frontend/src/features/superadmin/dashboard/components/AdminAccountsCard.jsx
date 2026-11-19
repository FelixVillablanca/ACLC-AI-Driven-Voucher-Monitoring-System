import { Link } from 'react-router-dom'
import { UserRoundPlus } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import Pill from '@/components/common/Pill'
import { CREATE_ADMIN_SEARCH } from '@/features/superadmin/admins'
import { PATHS } from '@/lib/constants'
import { formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { describeAdmin } from '../utils'

/**
 * "Admin accounts" (Framer uH0wO9f5O, 360px): the newest admin accounts with their status.
 * "Manage →" opens the full Admins page.
 */
export default function AdminAccountsCard({ admins }) {
  return (
    <section aria-labelledby="admins-title" className="flex w-full flex-col rounded-xl border bg-card lg:w-[360px] lg:shrink-0">
      <div className="flex items-center justify-between gap-2.5 border-b px-[18px] pt-4 pb-3.5">
        <h2 id="admins-title" className="text-card-title">
          Admin accounts
        </h2>
        <Link to={PATHS.SUPERADMIN_ADMINS} className="text-auth-link text-primary hover:underline">
          Manage →
        </Link>
      </div>

      {admins.length === 0 ? (
        <EmptyState
          icon={UserRoundPlus}
          title="No admin accounts yet"
          description="Admins set up companies, departments and users. Add the first one."
          action={
            <Link to={{ search: CREATE_ADMIN_SEARCH }} className="text-auth-link text-primary hover:underline">
              Add admin
            </Link>
          }
          className="p-8"
        />
      ) : (
        <ul>
          {admins.map((admin) => {
            const row = describeAdmin(admin)
            const inactive = admin.status === 'inactive'
            return (
              <li key={admin.id} className="flex items-center gap-2.5 border-b px-[18px] py-2.5 last:border-b-0">
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full',
                    inactive ? 'text-caption bg-muted' : 'text-badge bg-primary-soft text-primary',
                  )}
                >
                  {formatInitials(admin)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <p className="text-body-strong truncate" title={admin.email}>
                    {admin.full_name}
                  </p>
                  <p className="text-caption truncate">{row.caption}</p>
                </div>
                <Pill tone={row.pill.tone}>{row.pill.text}</Pill>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

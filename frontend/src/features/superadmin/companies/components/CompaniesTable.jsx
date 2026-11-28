import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { companyInitials, companySubtitle, lastActivityText, tileTone } from '../utils'
import { CompanyActions, StatusPill } from './CompanyCard'

/**
 * List view (C4, frame jlXT7qlCt): the same companies as a table. A suspended row is tinted amber
 * and shows "12 blocked" in the Users column. Scrolls sideways on narrow screens.
 */
export default function CompaniesTable({ companies, onAction }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead className="border-b bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th scope="col" className="w-[310px] px-[18px] py-2.5 font-semibold">
                Company
              </th>
              <th scope="col" className="w-[120px] py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="w-[110px] py-2.5 font-semibold">
                Departments
              </th>
              <th scope="col" className="w-[100px] py-2.5 font-semibold">
                Users
              </th>
              <th scope="col" className="w-[130px] py-2.5 font-semibold">
                Last activity
              </th>
              <th scope="col" className="py-2.5 font-semibold">
                Admin
              </th>
              <th scope="col" className="w-[170px] py-2.5 pr-[18px] font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const suspended = c.status === 'suspended'
              return (
                <tr key={c.id} className={cn('border-b last:border-b-0', suspended && 'bg-warning-soft')}>
                  <td className="px-[18px] py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={cn(
                          'text-badge flex size-[34px] shrink-0 items-center justify-center rounded-lg',
                          suspended ? 'bg-card text-muted-foreground' : tileTone(c),
                        )}
                        aria-hidden="true"
                      >
                        {companyInitials(c.name)}
                      </div>
                      <div className="flex min-w-0 flex-col gap-px">
                        <p className="text-body-strong truncate">
                          {c.name}
                          {c.is_new && <span className="text-caption text-primary"> · New</span>}
                        </p>
                        <p className="text-caption truncate">{companySubtitle(c)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <StatusPill status={c.status} className={suspended ? 'bg-card' : undefined} />
                  </td>
                  <td className="text-body py-2.5">{formatNumber(c.departments_count)}</td>
                  <td className="text-body py-2.5">
                    {formatNumber(c.users_count)}
                    {suspended && ' blocked'}
                  </td>
                  <td className="text-body py-2.5">{lastActivityText(c.last_activity_at)}</td>
                  <td className="text-caption py-2.5">
                    {c.admin ? (
                      c.admin.full_name
                    ) : c.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => onAction('add-admin', c)}
                        className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        + Add admin
                      </button>
                    ) : (
                      <span className="text-warning">No Admin yet</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-[18px]">
                    <CompanyActions company={c} onAction={onAction} compact />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

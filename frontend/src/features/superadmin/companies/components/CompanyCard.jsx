import Pill from '@/components/common/Pill'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { companyInitials, companySubtitle, lastActivityText, sinceText, suspendedText, tileTone } from '../utils'

/**
 * One company card (Framer vnNFYExpX): logo initials, name (+ "New"), type · address, status pill,
 * a Muted strip with Departments / Users / Last activity, and "Admin: … · since …" with the actions.
 * A suspended company gets an amber border and an amber note with who suspended it and why
 * (Northfield Academy in the frame), and Open + Reactivate instead of Suspend + Open.
 *
 * Open shows the C8 company side panel (CompanyPanel).
 */
export default function CompanyCard({ company, onAction }) {
  const suspended = company.status === 'suspended'

  return (
    <article
      aria-label={company.name}
      className={cn('flex flex-col gap-3.5 rounded-xl border bg-card px-[18px] py-4', suspended && 'border-warning')}
    >
      <div className="flex items-start gap-3">
        <div className={cn('text-badge flex size-11 shrink-0 items-center justify-center rounded-[10px]', tileTone(company))} aria-hidden="true">
          {companyInitials(company.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="text-card-title truncate" title={company.name}>
              {company.name}
            </h3>
            {company.is_new && <Pill className="px-1.5 py-px">New</Pill>}
          </div>
          <p className="text-caption truncate" title={companySubtitle(company)}>
            {companySubtitle(company)}
          </p>
        </div>
        <StatusPill status={company.status} />
      </div>

      {suspended ? (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-warning-soft px-3.5 py-2.5">
          <p className="text-badge text-warning">{suspendedText(company.suspension)}</p>
          <p className="text-caption">
            {company.suspension.reason && <>“{company.suspension.reason}” · </>}
            {plural(company.users_count, 'user', 'users')} blocked · data kept
          </p>
        </div>
      ) : (
        <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-muted px-3.5 py-2.5">
          <Stat label="Departments" value={formatNumber(company.departments_count)} />
          <Stat label="Users" value={formatNumber(company.users_count)} />
          <Stat label="Last activity" value={lastActivityText(company.last_activity_at)} />
        </dl>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-caption min-w-0">
          {company.admin ? (
            <>Admin: {company.admin.full_name}</>
          ) : (
            <>
              <span className="text-warning">No Admin yet</span>
              {company.status === 'active' && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => onAction('add-admin', company)}
                    className="rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Add admin
                  </button>
                </>
              )}
            </>
          )}
          {sinceText(company.created_at) && <> · {sinceText(company.created_at)}</>}
        </p>
        <CompanyActions company={company} onAction={onAction} />
      </div>
    </article>
  )
}

export function StatusPill({ status, className }) {
  if (status === 'suspended')
    return (
      <Pill tone="warning" className={className}>
        Suspended
      </Pill>
    )
  if (status === 'inactive')
    return (
      <Pill tone="neutral" className={className}>
        Inactive
      </Pill>
    )
  return (
    <Pill tone="success" className={className}>
      Active
    </Pill>
  )
}

/** Suspend + Open (active) or Open + Reactivate (suspended), the same on a card and in a list row. */
export function CompanyActions({ company, onAction, compact = false }) {
  const suspended = company.status === 'suspended'
  const open = (
    <button
      type="button"
      onClick={() => onAction('open', company)}
      className={cn(
        'text-auth-link rounded-lg text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        compact ? 'hover:underline' : 'h-8 border bg-card px-3 hover:bg-muted',
      )}
    >
      Open
    </button>
  )

  if (suspended) {
    return (
      <div className="flex items-center gap-2">
        {open}
        <button
          type="button"
          onClick={() => onAction('reactivate', company)}
          className={cn(
            'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            compact
              ? 'text-auth-link rounded text-success hover:underline'
              : 'text-auth-button h-8 rounded-lg bg-primary px-3 text-primary-foreground hover:bg-primary/90',
          )}
        >
          Reactivate
        </button>
      </div>
    )
  }

  const suspend =
    company.status === 'active' ? (
      <button
        type="button"
        onClick={() => onAction('suspend', company)}
        className="text-body-strong rounded px-1 text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Suspend
      </button>
    ) : null

  return (
    <div className={cn('flex items-center', compact ? 'gap-3' : 'gap-2')}>
      {compact ? (
        <>
          {open}
          {suspend}
        </>
      ) : (
        <>
          {suspend}
          {open}
        </>
      )}
    </div>
  )
}

/** Value on top, label underneath (as in the frame); screen readers hear "Departments: 8". */
function Stat({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-px">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body-strong truncate">{value}</dd>
    </div>
  )
}

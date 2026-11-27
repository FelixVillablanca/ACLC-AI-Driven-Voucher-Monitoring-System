import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { step2Text } from '../utils'

/** Pieces shared by the Final review (Nl0dfYkY_) and Investigate flag (lFqUUsfzi) pages, 2026-11-27. */

const ROLE = { accounting_officer: 'Accounting', supervisor_manager: 'Supervisor / Manager' }

function Step({ tone, title, sub }) {
  const dot = { done: 'bg-success', current: 'bg-primary ring-4 ring-primary-soft', warning: 'bg-warning', danger: 'bg-danger' }[tone]
  return (
    <li className="flex gap-3">
      <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-body-strong', tone === 'current' && 'text-primary')}>{title}</span>
        {sub && <span className="text-caption break-words">{sub}</span>}
      </div>
    </li>
  )
}

export function Similar({ items }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((s) => (
        <li key={s.id} className="text-caption flex items-center justify-between gap-2 rounded-md bg-card px-2.5 py-1.5">
          <span className="truncate">
            <strong className="font-semibold text-foreground">{s.voucher_number}</strong> · {s.status.replace('_', ' ')}
            {s.submitted_at ? ` · ${formatDate(s.submitted_at, 'MMM d')}` : ''}
          </span>
          <span className="text-body-strong shrink-0 tabular-nums">{formatMoney(s.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

export function BudgetImpact({ budget, department }) {
  if (!budget) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-card-title">Budget impact</h2>
        <p className="text-caption mt-1">
          {department ? `No ${department} budget is set for this year.` : 'This voucher has no department.'}
        </p>
      </section>
    )
  }
  const over = budget.over_by
  const near = !over && budget.after_pct >= budget.alert_pct
  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-4',
        over ? 'border-danger/40 bg-danger-soft' : near ? 'border-warning/40 bg-warning-soft' : 'bg-card',
      )}
    >
      <h2 className="text-card-title">Budget impact</h2>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption">
          {department} used · {budget.period}
        </span>
        <span className={cn('text-badge tabular-nums', over ? 'text-danger' : near ? 'text-warning' : 'text-success')}>
          {budget.used_pct}% → {budget.after_pct}%
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-card"
        role="progressbar"
        aria-valuenow={budget.after_pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Budget used after this voucher"
      >
        <div
          className={cn('h-full rounded-full', over ? 'bg-danger' : near ? 'bg-warning' : 'bg-success')}
          style={{ width: `${Math.min(100, budget.after_pct)}%` }}
        />
      </div>
      <p className={cn('text-caption', over && 'font-semibold text-danger')}>
        {over ? `Over budget by ${formatMoney(over)} if approved` : `${formatMoney(budget.remaining_after)} left after this voucher`}
      </p>
    </section>
  )
}

/** Submitted → Level 1 → (earlier returns) → Level 2 waiting / decided. */
export function Trail({ v }) {
  const r = v.review
  const waiting = v.status === 'under_review'
  const verb = (h) =>
    h.action === 'approved'
      ? h.step === 2
        ? 'gave the final approval'
        : 'approved at Level 1'
      : h.action === 'returned'
        ? h.sent_to === 'accounting'
          ? 'returned it to Accounting'
          : 'returned it to the clerk'
        : 'rejected it'
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="l2-trail">
      <h2 id="l2-trail" className="text-card-title">
        Approval trail
      </h2>
      <ol className="flex flex-col gap-3">
        <Step
          tone="done"
          title={`Submitted by ${v.clerk?.name ?? 'the clerk'} (Accounting Clerk)`}
          sub={formatDate(v.submitted_at, 'MMM d, yyyy · h:mm a')}
        />
        {v.history.map((h, i) => (
          <Step
            key={i}
            tone={h.action === 'approved' ? 'done' : h.action === 'rejected' ? 'danger' : 'warning'}
            title={`${h.by ?? 'Someone'} (${ROLE[h.role] ?? h.role}) ${verb(h)}`}
            sub={`${formatDate(h.at, 'MMM d · h:mm a')}${h.remarks ? ` · “${h.remarks}”` : ''}${h.needs_changes?.length ? ` · ${h.needs_changes.join(', ')}` : ''}${h.reason ? ` · ${h.reason}` : ''}`}
          />
        ))}
        {waiting && <Step tone="current" title="Level 2 · waiting for you" sub={`Required: ${step2Text(r.step2_reasons)}`} />}
      </ol>
    </section>
  )
}

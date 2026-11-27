import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileBarChart, PieChart, Stamp } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { usePageTitle } from '@/hooks/usePageTitle'
import { compactMoney } from '@/features/budgets'
import { DECISIONS_CHANGED_EVENT, level2Path, shortName } from '@/features/supervisor'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, greeting, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getSupervisorDashboard } from '../api'

/**
 * SUPERVISOR / MANAGER DASHBOARD (/supervisor, the landing page; Framer YKfX_oJ3a), 2026-11-27. Real numbers only, for
 * the company in the switcher (GET /api/v1/supervisor/dashboard). Refreshes after a decision and every 60 s.
 * Polish 2026-11-27: the frame's "Reports" button, the budget card / alert open Budgets, and a "Waiting for your
 * sign-off" card (budget changes + financial reports) once those pages existed.
 * Code differs from the frame: "Flagged" (the automatic check) instead of "AI-flagged"; "Approved this month" = every voucher that
 * got its final approval in the company this month ("released"); the budget alert only shows when a department would
 * pass its alert % if everything waiting for it at Level 2 were approved.
 */
export default function SupervisorDashboardPage() {
  usePageTitle('Dashboard')
  const user = useAuthStore((s) => s.user)
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${companyId}|${attempt}`

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      getSupervisorDashboard({ background: quiet })
        .then((data) => alive && setState({ key, status: 'success', data, error: null }))
        .catch((error) => alive && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(DECISIONS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      alive = false
      window.removeEventListener(DECISIONS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
  }, [key])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const waiting = d?.queue.total ?? 0

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">
            {greeting()}
            {user?.first_name ? `, ${user.first_name}` : ''}
          </h1>
          <p className="text-body text-muted-foreground">
            {['Level 2 final approval', d?.company, formatDate(new Date(), 'EEEE, MMM d, yyyy')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={PATHS.SUPERVISOR_REPORTS}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <FileBarChart className="size-4" aria-hidden="true" /> Reports
          </Link>
          <Link
            to={PATHS.SUPERVISOR_QUEUE}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {d && waiting === 0 ? 'Open approval queue' : `Review approvals${d ? ` (${waiting})` : ''}`}{' '}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {status === 'loading' && <Skeleton />}
      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your dashboard"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {d && (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to={PATHS.SUPERVISOR_QUEUE}
              className="flex flex-col gap-1 rounded-xl bg-primary-dark px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="text-caption text-on-dark-muted">Awaiting your approval</span>
              <span className="text-stat-value text-white tabular-nums">{waiting}</span>
              <span className="text-caption text-on-dark-muted">
                {waiting
                  ? `${formatMoney(d.queue.total_amount)}${d.queue.oldest_days != null ? ` · oldest ${d.queue.oldest_days === 0 ? 'today' : plural(d.queue.oldest_days, 'day', 'days')}` : ''}`
                  : 'Nothing waiting'}
              </span>
            </Link>
            <Stat
              label="Flagged"
              to={PATHS.SUPERVISOR_FLAGGED}
              value={d.queue.flagged}
              danger={d.queue.flagged > 0}
              caption={d.queue.flagged ? 'Mandatory review, with your reason' : 'Nothing flagged at Level 2'}
            />
            <Stat
              label={`Approved in ${d.released.month}`}
              to={PATHS.SUPERVISOR_HISTORY}
              value={d.released.count}
              caption={d.released.count ? `${compactMoney(d.released.amount)} released` : 'Nothing released yet this month'}
              title={formatMoney(d.released.amount)}
            />
            <Stat
              label="Company budget used"
              to={PATHS.SUPERVISOR_BUDGETS}
              value={d.budget ? `${d.budget.used_pct}%` : '—'}
              caption={
                d.budget
                  ? `${compactMoney(d.budget.used)} of ${compactMoney(d.budget.total)} · ${d.budget.label}`
                  : 'No budgets set for this year'
              }
            />
          </div>

          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
            <NeedsDecision d={d} />
            <div className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:shrink-0">
              <Signoffs s={d.signoffs} />
              <Pipeline p={d.pipeline} />
              {d.alert && <BudgetAlert a={d.alert} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, caption, to, danger, title }) {
  const body = (
    <>
      <span className={cn('text-caption', danger && 'text-badge text-danger')}>{label}</span>
      <span className="text-stat-value tabular-nums" title={title}>
        {value}
      </span>
      <span className="text-caption">{caption}</span>
    </>
  )
  const cls = cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5', danger ? 'border-danger bg-danger-soft' : 'bg-card')
  return to ? (
    <Link to={to} className={cn(cls, 'outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function NeedsDecision({ d }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card" aria-labelledby="sup-needs">
      <div className="flex items-center justify-between gap-2.5 px-4 pt-3.5 pb-3">
        <h2 id="sup-needs" className="text-card-title">
          Needs your decision
        </h2>
        {d.queue.total > 0 && (
          <Link to={PATHS.SUPERVISOR_QUEUE} className="text-auth-link text-primary hover:underline">
            View all {d.queue.total} →
          </Link>
        )}
      </div>
      {d.top.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t px-6 py-10 text-center">
          <CheckCircle2 className="size-7 text-success" aria-hidden="true" />
          <p className="text-card-title">Nothing waits for Level 2</p>
          <p className="text-caption">Vouchers appear here as soon as Accounting approves them.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead className="border-y bg-muted">
              <tr className="text-table-head text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Voucher</th>
                <th className="w-[130px] px-3 py-2 text-right font-semibold">Amount</th>
                <th className="w-[130px] px-3 py-2 font-semibold">Why it’s here</th>
                <th className="w-[110px] px-4 py-2 font-semibold">Level 1</th>
              </tr>
            </thead>
            <tbody>
              {d.top.map((v) => (
                <tr key={v.id} className={cn('border-b last:border-b-0', v.ai.flagged && 'bg-danger-soft')}>
                  <td className="px-4 py-2.5">
                    <Link to={level2Path(v.id)} className="text-body-strong text-primary hover:underline">
                      {v.voucher_number}
                    </Link>
                    <p className="text-caption truncate">{[v.department, v.payee_name].filter(Boolean).join(' · ') || '—'}</p>
                  </td>
                  <td className="text-body-strong px-3 py-2.5 text-right tabular-nums">{formatMoney(v.amount)}</td>
                  <td className="px-3 py-2.5">
                    {v.ai.flagged ? (
                      <Pill tone="danger" className="border border-danger">
                        ⚠ Flagged{v.ai.score ? ` ${Number(v.ai.score).toFixed(2)}` : ''}
                      </Pill>
                    ) : v.high_value ? (
                      <Pill tone="warning">High value</Pill>
                    ) : (
                      <Pill tone="neutral">Forwarded</Pill>
                    )}
                  </td>
                  <td className="text-caption px-4 py-2.5">{v.level1 ? `✓ ${shortName(v.level1.by)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Budget changes and financial reports waiting for your sign-off (each row opens its page). */
function Signoffs({ s }) {
  if (!s) return null
  const rows = [
    {
      to: PATHS.SUPERVISOR_BUDGETS,
      label: 'Budget changes',
      n: s.budget_changes,
      caption: Number(s.budget_top_ups) > 0 ? `${compactMoney(s.budget_top_ups)} in top-ups` : null,
    },
    { to: `${PATHS.SUPERVISOR_REPORTS}?signoff=pending`, label: 'Financial reports', n: s.reports, caption: null },
  ]
  const total = s.budget_changes + s.reports
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="sup-signoffs">
      <h2 id="sup-signoffs" className="text-card-title flex items-center gap-1.5">
        <Stamp className="size-4 text-primary" aria-hidden="true" /> Waiting for your sign-off
      </h2>
      {total === 0 ? (
        <p className="text-caption">No budget change or report is waiting for you.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.label}>
              <Link
                to={r.to}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg px-3 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
                  r.n ? 'bg-warning-soft' : 'bg-muted',
                )}
              >
                <span className="flex flex-col">
                  <span className="text-body">{r.label}</span>
                  {r.caption && r.n > 0 && <span className="text-caption">{r.caption}</span>}
                </span>
                <span className={cn('text-card-title tabular-nums', r.n && 'text-warning')}>{r.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Pipeline({ p }) {
  const rows = [
    ['Drafts (Clerks)', p.drafts, false],
    ['Level 1 · Accounting', p.level1, false],
    ['Level 2 · You', p.level2, true],
    ['Approved · this month', p.approved_this_month, false],
  ]
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="sup-pipeline">
      <h2 id="sup-pipeline" className="text-card-title">
        Approval pipeline
      </h2>
      <ol className="flex flex-col gap-1.5">
        {rows.map(([label, n, you]) => (
          <li
            key={label}
            className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2', you ? 'bg-primary-soft' : 'bg-muted')}
          >
            <span className={cn('text-body', you && 'text-body-strong text-primary')}>{label}</span>
            <span className={cn('text-card-title tabular-nums', you && 'text-primary')}>{n}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function BudgetAlert({ a }) {
  const what =
    a.waiting === a.waiting_flagged && a.waiting_flagged > 0
      ? `${a.waiting === 1 ? 'the flagged voucher' : `the ${a.waiting} flagged vouchers`}`
      : `the ${plural(a.waiting, 'voucher', 'vouchers')} waiting for you`
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-warning/40 bg-warning-soft p-4" aria-labelledby="sup-alert">
      <h2 id="sup-alert" className="text-badge flex items-center gap-1.5 text-warning">
        <PieChart className="size-4" aria-hidden="true" /> Budget alert
      </h2>
      <p className="text-body text-foreground">
        {`${a.department} is at ${a.used_pct}% of its budget. Approving ${what} (${formatMoney(a.waiting_amount)}) would push it to ${a.after_pct}%.`}
      </p>
      <Link to={PATHS.SUPERVISOR_BUDGETS} className="text-auth-link self-start text-primary hover:underline">
        Open budgets →
      </Link>
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="flex flex-col gap-3.5 lg:flex-row">
        <div className="h-[280px] flex-1 animate-pulse rounded-xl border bg-card" />
        <div className="h-[280px] w-full animate-pulse rounded-xl border bg-card lg:w-[300px]" />
      </div>
    </div>
  )
}

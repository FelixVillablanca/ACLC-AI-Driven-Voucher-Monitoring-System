import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Hourglass, ListChecks, TriangleAlert } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { REVIEWS_CHANGED_EVENT, reviewPath, waitedText } from '@/features/approvals'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, greeting, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getOfficerDashboard } from '../api'
import { usePageTitle } from '@/hooks/usePageTitle'

/**
 * ACCOUNTING OFFICER DASHBOARD (/officer, the landing page; Framer tfDekIe0N), 2026-11-27.
 * Real numbers only, for the company in the switcher (GET /api/v1/officer/dashboard). Refreshes after a
 * decision and every 60 s.
 * Code differs from the frame: "Approved in November" counts YOUR Level 1 approvals; budget health is this
 * FISCAL YEAR (budgets are yearly since 2026-11-27) and links to the Budgets pages; the
 * "✦ AI forecast" card is "Approved so far this month" (no forecasting model yet, so no prediction is shown);
 * "AI-flagged" is "Flagged" (the automatic check is rule-based for now).
 */
export default function OfficerDashboardPage() {
  usePageTitle('Dashboard')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${companyId}|${attempt}`

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      getOfficerDashboard({ background: quiet })
        .then((data) => alive && setState({ key, status: 'success', data, error: null }))
        .catch((error) => alive && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(REVIEWS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      alive = false
      window.removeEventListener(REVIEWS_CHANGED_EVENT, refresh)
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
            {['Level 1 review', d?.company, formatDate(new Date(), 'EEEE, MMM d, yyyy')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          disabled={!d || waiting === 0}
          onClick={() => navigate(reviewPath(d.top[0].id))}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {d && waiting === 0 ? 'Nothing to review' : `Start reviewing${d ? ` (${waiting})` : ''}`}{' '}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
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
            <Stat
              label="Awaiting your review"
              icon={ListChecks}
              to={PATHS.OFFICER_QUEUE}
              value={d.queue.total}
              caption={
                d.queue.total
                  ? `${formatMoney(d.queue.total_amount)}${d.queue.older_than_24h ? ` · ${d.queue.older_than_24h} older than 24 h` : ''}`
                  : 'The queue is empty'
              }
            />
            <Stat
              label="Flagged"
              icon={TriangleAlert}
              tone={d.queue.flagged ? 'danger' : undefined}
              to={PATHS.OFFICER_FLAGGED}
              value={d.queue.flagged}
              caption={d.queue.flagged ? 'Need a closer look before approving' : 'Nothing flagged right now'}
            />
            <Stat
              label={`You approved in ${d.mine.month}`}
              icon={CheckCircle2}
              iconTone="text-success"
              to={PATHS.OFFICER_REVIEWED}
              value={d.mine.approved}
              caption={
                d.mine.approved || d.mine.returned
                  ? `${formatMoney(d.mine.approved_amount)}${d.mine.returned ? ` · ${d.mine.returned} returned to clerks` : ''}`
                  : 'No decisions yet this month'
              }
            />
            <Stat
              label="Avg. review time"
              icon={Hourglass}
              iconTone="text-warning"
              value={d.review_time.avg_hours === null ? '—' : `${d.review_time.avg_hours} h`}
              caption={<ReviewTimeChange rt={d.review_time} />}
            />
          </div>

          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
            <QueuePreview d={d} />
            <div className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:shrink-0">
              <BudgetHealth budgets={d.budgets} />
              <SpendCard spend={d.spend} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, icon: Icon, iconTone = 'text-primary', value, caption, tone, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <span className={cn('text-caption', tone === 'danger' && 'text-badge text-danger')}>{label}</span>
        <Icon className={cn('size-4', tone === 'danger' ? 'text-danger' : iconTone)} aria-hidden="true" />
      </div>
      <span className="text-stat-value tabular-nums">{value}</span>
      <span className="text-caption">{caption}</span>
    </>
  )
  const cls = cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5', tone === 'danger' ? 'border-danger bg-danger-soft' : 'bg-card')
  return to ? (
    <Link to={to} className={cn(cls, 'outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** "↓ 18% vs October" (green when faster), or why there's nothing to compare. */
function ReviewTimeChange({ rt }) {
  if (rt.avg_hours === null) return 'No reviews yet this month'
  if (rt.change_pct === null) return `No reviews in ${rt.previous_month} to compare`
  const faster = rt.change_pct <= 0
  return (
    <span className={cn('text-badge', faster ? 'text-success' : 'text-warning')}>
      {faster ? '↓' : '↑'} {Math.abs(rt.change_pct)}% vs {rt.previous_month}
    </span>
  )
}

function QueuePreview({ d }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card" aria-labelledby="dash-queue">
      <div className="flex items-start justify-between gap-2.5 px-4 pt-3.5 pb-3">
        <div className="flex flex-col gap-px">
          <h2 id="dash-queue" className="text-card-title">
            Review queue
          </h2>
          <p className="text-caption">Oldest first · flagged pinned on top</p>
        </div>
        {d.queue.total > 0 && (
          <Link to={PATHS.OFFICER_QUEUE} className="text-auth-link text-primary hover:underline">
            View all {d.queue.total} →
          </Link>
        )}
      </div>

      {d.top.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t px-6 py-10 text-center">
          <CheckCircle2 className="size-7 text-success" aria-hidden="true" />
          <p className="text-card-title">Nothing waiting for review</p>
          <p className="text-caption">New submissions appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="border-y bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Voucher · payee</th>
                  <th className="w-[100px] px-3 py-2 font-semibold">Clerk</th>
                  <th className="w-[120px] px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="w-[96px] px-3 py-2 font-semibold">Check</th>
                  <th className="w-[84px] px-4 py-2 font-semibold">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.top.map((v) => (
                  <tr key={v.id} className={cn('border-b last:border-b-0', v.ai.flagged && 'bg-danger-soft')}>
                    <td className="px-4 py-2.5">
                      <p className="text-body-strong truncate">
                        {v.voucher_number} · {v.payee_name ?? 'No payee'}
                      </p>
                      <p className="text-caption">
                        {[v.category, v.submitted_at && `submitted ${waitedText(v.submitted_at)} ago`].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="text-body px-3 py-2.5" title={v.clerk.name ?? undefined}>
                      {v.clerk.short ?? '—'}
                    </td>
                    <td className="text-body-strong px-3 py-2.5 text-right tabular-nums">{formatMoney(v.amount)}</td>
                    <td className="px-3 py-2.5">
                      {v.ai.flagged ? (
                        <Pill tone="danger" className="border border-danger">
                          ⚠ {v.ai.score ?? 'Flagged'}
                        </Pill>
                      ) : v.high_value ? (
                        <Pill tone="warning">High value</Pill>
                      ) : v.ai.source ? (
                        <Pill tone="success">✓ Normal</Pill>
                      ) : (
                        <span className="text-caption">Not run</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={reviewPath(v.id)}
                        className={cn(
                          'flex h-8 w-[64px] items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                          v.ai.flagged
                            ? 'text-auth-button bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'text-body-strong border bg-card hover:bg-muted',
                        )}
                      >
                        {v.ai.flagged ? 'Review' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t px-4 py-2.5">
            <p className="text-caption">
              Showing {d.top.length} of {d.queue.total} · SLA: review within {d.queue.sla_hours} h
            </p>
            {d.queue.near_sla > 0 && <Pill tone="warning">{d.queue.near_sla} near SLA</Pill>}
          </div>
        </>
      )}
    </section>
  )
}

/** This fiscal year's department budgets, most used first; each opens its Budgets page (yearly since 2026-11-27). */
function BudgetHealth({ budgets }) {
  const rows = budgets.rows
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-4" aria-labelledby="dash-budgets">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dash-budgets" className="text-card-title">
          Budget health · {budgets.label}
        </h2>
        <Link to={PATHS.OFFICER_BUDGETS} className="text-auth-link text-primary hover:underline">
          Manage →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-caption">
          No department budgets for {budgets.label} yet.{' '}
          <Link to={`${PATHS.OFFICER_BUDGETS}?allocate=1`} className="text-primary hover:underline">
            Allocate one
          </Link>
        </p>
      ) : (
        <>
          <p className="text-caption">{budgets.elapsed_pct}% of the year has passed</p>
          {rows.slice(0, 6).map((b) => {
            const tone =
              b.used_pct >= b.alert_pct ? 'danger' : b.used_pct >= b.alert_pct - 15 ? 'warning' : b.used_pct >= 50 ? 'primary' : 'success'
            const TONE = {
              danger: ['text-danger', 'bg-danger'],
              warning: ['text-warning', 'bg-warning'],
              primary: ['text-primary', 'bg-primary'],
              success: ['text-success', 'bg-success'],
            }[tone]
            return (
              <Link
                key={b.department_id}
                to={`${PATHS.OFFICER_BUDGETS}/${b.department_id}`}
                className="-mx-1.5 flex flex-col gap-1.5 rounded-md px-1.5 py-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-strong truncate">{b.department}</span>
                  <span className={cn('text-badge tabular-nums', TONE[0])} title={`${formatMoney(b.used)} of ${formatMoney(b.total)}`}>
                    {b.used_pct}%{tone === 'danger' ? ' ⚠' : ''}
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={b.used_pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${b.department} budget used`}
                >
                  <div className={cn('h-full rounded-full', TONE[1])} style={{ width: `${Math.min(100, b.used_pct)}%` }} />
                </div>
              </Link>
            )
          })}
          {rows.length > 6 && <p className="text-caption">+{plural(rows.length - 6, 'more department', 'more departments')}</p>}
        </>
      )}
    </section>
  )
}

/** In the frame's "AI forecast" spot: real approved spending so far this month, with a link to Forecasts (2026-11-27). */
function SpendCard({ spend }) {
  const has = Number(spend.approved_amount) > 0
  return (
    <section className="flex flex-col gap-1.5 rounded-xl bg-primary-dark p-4" aria-labelledby="dash-spend">
      <p id="dash-spend" className="text-caption text-on-dark-muted">
        Approved so far · {spend.month}
      </p>
      <p className="text-stat-value text-white tabular-nums">{formatMoney(spend.approved_amount)}</p>
      <p className="text-caption text-on-dark-muted">
        {!has
          ? 'Nothing approved yet this month.'
          : spend.change_pct === null
            ? `Nothing was approved by this point in ${spend.previous_month}.`
            : `${spend.change_pct >= 0 ? '+' : '−'}${Math.abs(spend.change_pct)}% vs the same days of ${spend.previous_month}.`}
      </p>
      <Link to={PATHS.OFFICER_FORECASTS} className="text-caption text-on-dark-muted/80 hover:text-white hover:underline">
        See the spending forecast →
      </Link>
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3.5 lg:flex-row">
        <div className="h-[280px] flex-1 animate-pulse rounded-xl border bg-card" />
        <div className="flex w-full flex-col gap-3.5 lg:w-[300px]">
          <div className="h-[180px] animate-pulse rounded-xl border bg-card" />
          <div className="h-[120px] animate-pulse rounded-xl bg-primary-dark/80" />
        </div>
      </div>
    </div>
  )
}

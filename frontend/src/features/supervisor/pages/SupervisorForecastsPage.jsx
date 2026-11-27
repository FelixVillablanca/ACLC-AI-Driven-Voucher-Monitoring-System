import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Info, PieChart, TrendingUp } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { inputClass } from '@/components/common/FieldShell'
import { compactMoney } from '@/features/budgets'
import { ForecastChart, RiskPill } from '@/features/forecasts'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getSupervisorForecasts } from '../api'
import { outlineBtn, primaryBtn } from '../utils'

const RISK_WORD = { over: 'over', tight: 'tight', on_track: 'ok', no_budget: 'no budget', no_forecast: 'no forecast' }
const RISK_TEXT = { over: 'text-danger', tight: 'text-warning', on_track: 'text-success' }

/**
 * FORECASTS for the Supervisor / Manager (/supervisor/forecasts[?department=]; Framer wY0BB3HcK), 2026-11-27. Read-only:
 * the stored forecasts Accounting sees, for the whole company or one department. Cards: next month (+ likely range),
 * where the fiscal year is heading vs the budgets, confidence (R² + months of data). Chart actual vs forecast; next
 * month by department with its risk; a plain recommendation from the real risks and the budget changes waiting.
 * Code differs from the frame: "Forecasts" / "linear trend", not "AI forecasts" / Linear Regression model (same rule as
 * Flagged); the year-end card says "through {month}" when the stored forecasts don't reach the end of the fiscal year;
 * the recommendation is written from the numbers (no AI text).
 */
export default function SupervisorForecastsPage() {
  usePageTitle('Forecasts')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const department = Number(params.get('department')) || null
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([companyId, department, attempt])

  useEffect(() => {
    const ctrl = new AbortController()
    getSupervisorForecasts({ department, signal: ctrl.signal })
      .then((data) => setState({ key, status: 'success', data, error: null }))
      .catch((error) => !ctrl.signal.aborted && setState({ key, status: 'error', data: null, error }))
    return () => ctrl.abort()
  }, [key, department])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const pick = (id) => setParams(id ? { department: String(id) } : {}, { replace: true })
  const next = d?.next_month
  const ye = d?.year_end
  const noHistory = d && !next && d.months_used < d.min_months

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Forecasts{d?.view === 'department' ? ` · ${d.department.name}` : ''}</h1>
          <p className="text-body text-muted-foreground">
            Linear trend of approved spending
            {d ? (d.generated_at ? ` · updated ${formatDate(d.generated_at, 'MMM d, yyyy')}` : ' · not worked out yet') : ''}
            {d ? ` · ${d.company}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="sv-fc-dept" className="sr-only">
            Department
          </label>
          <select
            id="sv-fc-dept"
            value={department ?? ''}
            disabled={!d}
            onChange={(e) => pick(Number(e.target.value) || null)}
            className={cn(inputClass, 'h-[38px] w-auto pr-8')}
          >
            <option value="">All departments</option>
            {(d?.departments ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <Link to={PATHS.SUPERVISOR_BUDGETS} className={outlineBtn}>
            <PieChart className="size-4" aria-hidden="true" /> Open budgets
          </Link>
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={state.error.status === 404 ? 'Department not found' : "Couldn't load forecasts"}
            message={state.error.status === 404 ? 'It isn’t a department of the company you’re working in.' : state.error.message}
            requestId={state.error.status === 404 ? undefined : state.error.requestId}
            onRetry={state.error.status === 404 ? () => pick(null) : () => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'loading' && (
        <div role="status" aria-label="Loading forecasts" className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
          <div className="flex flex-col gap-3.5 lg:flex-row">
            <div className="h-[300px] flex-1 animate-pulse rounded-xl border bg-card" />
            <div className="h-[300px] animate-pulse rounded-xl border bg-card lg:w-[340px]" />
          </div>
        </div>
      )}

      {d && (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Card
              label={next ? `${next.label} forecast` : 'Next month forecast'}
              value={next ? compactMoney(next.predicted) : '—'}
              title={next ? formatMoney(next.predicted) : undefined}
              caption={
                next
                  ? `Likely ${compactMoney(next.lower)} – ${compactMoney(next.upper)}`
                  : noHistory
                    ? `Needs ${d.min_months} months of approved spending (has ${d.months_used})`
                    : 'No forecast yet'
              }
            />
            <Card
              label={ye.complete || !ye.projection ? `${ye.label} year-end projection` : `${ye.label} projection through ${ye.through}`}
              value={ye.projection ? compactMoney(ye.projection) : '—'}
              title={ye.projection ? `${formatMoney(ye.approved)} approved + ${formatMoney(ye.expected)} expected` : undefined}
              caption={
                !ye.projection ? (
                  'No forecast yet'
                ) : ye.diff === null ? (
                  'No budget set to compare with'
                ) : Number(ye.diff) > 0 ? (
                  <span className="text-danger">{compactMoney(ye.diff)} over plan</span>
                ) : (
                  <span className="text-success">{compactMoney(String(-Number(ye.diff)))} under plan</span>
                )
              }
            />
            <Card
              label="Confidence"
              value={next ? `${next.confidence}%` : '—'}
              caption={
                d.r_squared !== null && d.r_squared !== undefined
                  ? `R² ${Number(d.r_squared).toFixed(2)} · ${plural(d.months_used, 'month', 'months')} of data`
                  : `${plural(d.months_used, 'month', 'months')} of data`
              }
            />
          </div>

          <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
            <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="sv-fc-chart">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="sv-fc-chart" className="text-card-title">
                  {d.view === 'department' ? d.department.name : 'Company'} spend · actual and forecast
                </h2>
                <span className="text-caption flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm border border-dashed border-primary bg-primary-soft" aria-hidden="true" /> Forecast
                  </span>
                </span>
              </div>
              {d.chart?.length ? (
                <ForecastChart
                  points={d.chart}
                  height={210}
                  danger={d.view === 'department' && d.risk?.level === 'over'}
                  label="Approved spending by month and the forecast for the next months"
                />
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="Nothing to chart yet"
                  description="Approved vouchers build the history the forecast needs."
                />
              )}
            </section>

            <aside className="flex w-full flex-col gap-3.5 lg:w-[340px] lg:shrink-0">
              {d.view === 'company' ? <ByDepartment d={d} onPick={pick} /> : <DepartmentBudget d={d} />}
              <Recommendation d={d} />
            </aside>
          </div>

          <p className="text-caption flex items-start gap-2 rounded-xl border bg-primary-faint px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Forecasts draw a straight line through each month&apos;s approved spending (at least {d.min_months} months are needed) and are
              worked out again on the 1st of every month. They&apos;re estimates, not limits.
            </span>
          </p>
        </>
      )}
    </div>
  )
}

function Card({ label, value, caption, title }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-[18px] py-4">
      <span className="text-caption">{label}</span>
      <span className="text-stat-value tabular-nums" title={title}>
        {value}
      </span>
      <span className="text-caption">{caption}</span>
    </div>
  )
}

/** "December by department": next month's forecast + risk; a click opens that department. */
function ByDepartment({ d, onPick }) {
  const label = d.next_month?.label ?? 'Next month'
  return (
    <section className="flex flex-col rounded-xl border bg-card" aria-labelledby="sv-fc-depts">
      <h2 id="sv-fc-depts" className="text-card-title border-b px-5 py-3.5">
        {label} by department
      </h2>
      {d.rows.length === 0 ? (
        <p className="text-caption px-5 py-5">This company has no departments yet.</p>
      ) : (
        <ul>
          {d.rows.map((r) => (
            <li key={r.department.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(r.department.id)}
                className="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <span className="text-body truncate">{r.department.name}</span>
                <span className="text-caption shrink-0 tabular-nums">
                  {r.next_month ? compactMoney(r.next_month.predicted) : '—'}
                  <span className={cn('text-badge', RISK_TEXT[r.risk.level])}> · {RISK_WORD[r.risk.level] ?? r.risk.level}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DepartmentBudget({ d }) {
  const b = d.budget
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5" aria-labelledby="sv-fc-budget">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sv-fc-budget" className="text-card-title">
          {d.year_label} budget
        </h2>
        <RiskPill risk={d.risk} />
      </div>
      {b ? (
        <>
          <p className="text-body">
            {formatMoney(b.used)} used of {formatMoney(b.total)} · {b.used_pct}%
          </p>
          {d.risk.expected && (
            <p className="text-caption">
              About {formatMoney(d.risk.expected)} more expected through {d.risk.until}; {formatMoney(d.risk.budget_left)} left.
            </p>
          )}
        </>
      ) : (
        <p className="text-caption">Accounting hasn’t set a budget for this department this year.</p>
      )}
    </section>
  )
}

/** Written from the real risks + the budget changes waiting for a Supervisor (no AI text). */
function Recommendation({ d }) {
  const waiting = d.pending_requests.count
  let text
  if (d.view === 'company') {
    const over = d.rows.filter((r) => r.risk.level === 'over')
    const tight = d.rows.filter((r) => r.risk.level === 'tight')
    if (over.length) {
      text = `${over.map((r) => `${r.department.name} (${compactMoney(r.risk.shortfall)} short)`).join(', ')} ${over.length === 1 ? 'is' : 'are'} expected to run out of budget by ${over[0].risk.until}.`
      if (tight.length) text += ` ${tight.map((r) => r.department.name).join(', ')} ${tight.length === 1 ? 'is' : 'are'} tight.`
    } else if (tight.length) {
      text = `No department is expected to go over budget, but ${tight.map((r) => r.department.name).join(', ')} ${tight.length === 1 ? 'is' : 'are'} tight.`
    } else if (d.rows.some((r) => r.risk.level === 'on_track')) {
      text = 'Every department with a budget and a forecast is on track.'
    } else {
      text = 'There isn’t enough to compare yet: forecasts need 3 months of approved spending and a budget for the year.'
    }
  } else {
    const rec = d.recommendation
    if (rec) {
      text = `A top-up of about ${formatMoney(rec.top_up)} would cover the expected spending through ${d.risk.until}.`
      if (rec.defer) text += ` The biggest voucher still in review is ${rec.defer.voucher_number} (${formatMoney(rec.defer.amount)}).`
    } else if (d.risk.level === 'tight') {
      text = `Spending is close to the budget left (${d.risk.pct}% of it expected through ${d.risk.until}).`
    } else if (d.risk.level === 'on_track') {
      text = `On track: the expected spending through ${d.risk.until} fits the budget left.`
    } else {
      text =
        d.risk.level === 'no_budget'
          ? 'No budget is set, so there is nothing to compare the forecast with.'
          : 'Not enough history for a forecast yet.'
    }
  }
  const waitingHere = d.view === 'department' ? d.pending_requests.departments.includes(d.department.id) : waiting > 0

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary-faint p-4" aria-labelledby="sv-fc-rec">
      <h2 id="sv-fc-rec" className="text-badge text-primary">
        What this means
      </h2>
      <p className="text-body">{text}</p>
      {waitingHere ? (
        <Link to={PATHS.SUPERVISOR_BUDGETS} className={cn(primaryBtn, 'self-start')}>
          Review top-ups{d.view === 'company' ? ` (${waiting})` : ''} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <p className="text-caption">
          No budget change is waiting for your sign-off{d.view === 'department' ? ' for this department' : ''}.
        </p>
      )}
    </section>
  )
}

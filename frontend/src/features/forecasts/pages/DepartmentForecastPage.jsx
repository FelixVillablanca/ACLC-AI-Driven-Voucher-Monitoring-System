import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Info, PieChart, Sparkles, TrendingUp } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { reviewPath } from '@/features/approvals'
import { BudgetFormModal, budgetPath, compactMoney } from '@/features/budgets'
import { PATHS } from '@/lib/constants'
import { formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getDepartmentForecast } from '../api'
import ForecastChart from '../components/ForecastChart'
import HowCalculatedDialog from '../components/HowCalculatedDialog'
import RiskPill from '../components/RiskPill'
import { FORECASTS_CHANGED_EVENT, MONTH_CHOICES } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * ONE DEPARTMENT'S FORECAST (/officer/forecasts/:departmentId?months=; Framer sjtX1kKqt), 2026-11-27.
 * Next month's forecast + range, budget left (short by / room left), confidence + R², actual vs forecast chart,
 * what's driving it, and a top-up recommendation when the forecast goes past the budget.
 * "Adjust budget" / "Apply top-up" open the Budgets Edit allocation dialog (pre-filled with the top-up; the usual
 * rules apply: a reason, and a Supervisor's sign-off above the limit).
 * Code differs from the frame: no "✦" (a linear trend, not AI yet); drivers are real (vouchers in review, the trend,
 * the same month last year, payees paid then); no budget → "Set a budget" instead of a recommendation.
 */
export default function DepartmentForecastPage() {
  const { departmentId } = useParams()
  const [params] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const months = MONTH_CHOICES.includes(Number(params.get('months'))) ? Number(params.get('months')) : 3
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState(null) // null | 'how' | 'adjust' | 'topup'
  const key = `${companyId}|${departmentId}|${months}|${attempt}`

  useEffect(() => {
    const ctrl = new AbortController()
    const load = (quiet) =>
      getDepartmentForecast(departmentId, months, { signal: ctrl.signal })
        .then((data) => setState({ key, status: 'success', data, error: null }))
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(FORECASTS_CHANGED_EVENT, refresh)
    return () => {
      ctrl.abort()
      window.removeEventListener(FORECASTS_CHANGED_EVENT, refresh)
    }
  }, [key, departmentId, months])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  usePageTitle(d ? `${d.department.name} forecast` : 'Forecast')
  const backTo = `${PATHS.OFFICER_FORECASTS}${months !== 3 ? `?months=${months}` : ''}`

  if (status === 'error') {
    const missing = state.error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
        <BackLink to={PATHS.OFFICER_FORECASTS} />
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={missing ? 'Department not found' : "Couldn't load this forecast"}
            message={missing ? 'It isn’t a department of the company you’re working in.' : state.error.message}
            requestId={missing ? undefined : state.error.requestId}
            onRetry={missing ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      </div>
    )
  }

  const b = d?.budget
  const rec = d?.recommendation
  const reload = () => setAttempt((n) => n + 1)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">{d ? `${d.department.name} forecast` : 'Department forecast'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink to={backTo} inline />
            {d && <span>/ Linear trend on {plural(d.months_used, 'month', 'months')} of approved vouchers</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setDialog('how')} className={outlineBtn}>
            <Info className="size-4" aria-hidden="true" /> How it’s calculated
          </button>
          {d &&
            (b ? (
              <button
                type="button"
                onClick={() => setDialog('adjust')}
                disabled={b.pending_request}
                title={b.pending_request ? 'A budget change is already waiting for sign-off' : undefined}
                className={primaryBtn}
              >
                <PieChart className="size-4" aria-hidden="true" /> Adjust budget
              </button>
            ) : (
              <Link to={`${budgetPath(d.department.id)}?allocate=1`} className={primaryBtn}>
                <PieChart className="size-4" aria-hidden="true" /> Set a budget
              </Link>
            ))}
        </div>
      </div>

      {status === 'loading' && <Skeleton />}

      {d && !d.next_month && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={TrendingUp}
            title="Not enough history to forecast yet"
            description={`A forecast needs at least ${d.min_months} months of approved vouchers. ${d.department.name} has ${d.months_used} so far.`}
          />
        </div>
      )}

      {d && d.next_month && (
        <>
          <Cards d={d} />
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
            <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="dept-chart">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="dept-chart" className="text-card-title">
                  Monthly spend · actual and forecast
                </h2>
                <RiskPill risk={d.risk} />
              </div>
              <ForecastChart
                points={d.chart}
                danger={d.risk.level === 'over'}
                label={`${d.department.name}: approved spending and forecast`}
              />
              {d.risk.expected && (
                <p className="text-caption">
                  Still expected until {d.risk.until}:{' '}
                  <strong className="font-semibold text-foreground">{formatMoney(d.risk.expected)}</strong>
                  {d.risk.budget_left != null ? ` · budget left ${formatMoney(d.risk.budget_left)}` : ' · no budget set for this year'}
                  {d.risk.capped ? ' (the fiscal year ends sooner than the months you picked)' : ''}
                </p>
              )}
            </section>

            <div className="flex w-full flex-col gap-3.5 lg:w-[320px] lg:shrink-0">
              <Drivers drivers={d.drivers} />
              {rec && b && (
                <section className="flex flex-col gap-2 rounded-xl border border-primary bg-primary-soft p-4" aria-labelledby="dept-rec">
                  <p id="dept-rec" className="text-badge flex items-center gap-1.5 text-primary">
                    <Sparkles className="size-3.5" aria-hidden="true" /> Recommendation
                  </p>
                  <p className="text-body">
                    Top up {d.department.name} by {formatMoney(rec.top_up)}
                    {rec.defer ? (
                      <>
                        , or hold back{' '}
                        <Link to={reviewPath(rec.defer.id)} className="text-primary hover:underline">
                          {rec.defer.voucher_number}
                        </Link>{' '}
                        ({formatMoney(rec.defer.amount)}) until the next fiscal year.
                      </>
                    ) : (
                      '.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDialog('topup')}
                    disabled={b.pending_request}
                    className={cn(primaryBtn, 'h-9 w-full')}
                  >
                    Apply {compactMoney(rec.top_up)} top-up
                  </button>
                  {b.pending_request && <p className="text-caption">A budget change is already waiting for sign-off.</p>}
                </section>
              )}
              {rec && !b && (
                <p className="text-caption rounded-xl border bg-card p-4">
                  {d.department.name} has no {d.year_label} budget, so there’s nothing to compare the forecast with.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {dialog === 'how' && <HowCalculatedDialog key="how" minMonths={d?.min_months ?? 3} onClose={() => setDialog(null)} />}
        {(dialog === 'adjust' || dialog === 'topup') && d && b && (
          <BudgetFormModal
            key="budget"
            mode="edit"
            department={d.department}
            budget={b}
            year={d.fiscal_year}
            yearLabel={d.year_label}
            signoffAbove={d.signoff_above}
            initialTotal={dialog === 'topup' ? (Number(b.total) + Number(rec.top_up)).toFixed(2) : null}
            initialReason={
              dialog === 'topup'
                ? `Forecast top-up: ${formatMoney(d.risk.expected)} expected until ${d.risk.until}, ${formatMoney(d.risk.budget_left)} left.`
                : ''
            }
            onClose={() => setDialog(null)}
            onSaved={() => {
              setDialog(null)
              reload()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink({ to, inline }) {
  return (
    <Link to={to} className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}>
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Forecasts
    </Link>
  )
}

function Cards({ d }) {
  const n = d.next_month
  const risk = d.risk
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      <div className="flex flex-col gap-1 rounded-xl bg-primary-dark px-4 py-3.5">
        <span className="text-caption text-on-dark-muted">{n.label} forecast</span>
        <span className="text-stat-value text-white tabular-nums">{formatMoney(n.predicted)}</span>
        <span className="text-caption text-on-dark-muted">
          Range {compactMoney(n.lower)} – {compactMoney(n.upper)}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
        <span className="text-caption">Budget left</span>
        <span className="text-stat-value tabular-nums">{risk.budget_left != null ? formatMoney(risk.budget_left) : '—'}</span>
        <span
          className={cn(
            'text-badge',
            risk.level === 'over'
              ? 'text-danger'
              : risk.level === 'tight'
                ? 'text-warning'
                : risk.level === 'on_track'
                  ? 'text-success'
                  : 'text-muted-foreground',
          )}
        >
          {risk.level === 'over'
            ? `Short by ${formatMoney(risk.shortfall)}`
            : risk.level === 'tight'
              ? `Tight: ${risk.pct}% of it is expected`
              : risk.level === 'on_track'
                ? `Room left: ${formatMoney(Number(risk.budget_left) - Number(risk.expected))}`
                : `No ${d.year_label} budget`}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
        <span className="text-caption">Confidence</span>
        <span className="text-stat-value tabular-nums">{n.confidence}%</span>
        <span className="text-caption">
          R² {d.r_squared?.toFixed(2)} · {plural(d.months_used, 'month', 'months')} of data
          {d.accuracy ? ` · ${d.accuracy.pct}% accurate lately` : ''}
        </span>
      </div>
    </div>
  )
}

function Drivers({ drivers }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-4" aria-labelledby="dept-drivers">
      <h2 id="dept-drivers" className="text-card-title">
        What’s driving it
      </h2>
      {drivers.length === 0 ? (
        <p className="text-caption">Nothing stands out: the forecast follows the usual monthly spending.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {drivers.map((x, i) => (
            <li key={i} className="text-body flex gap-2">
              <span aria-hidden="true">•</span>
              <span>
                <DriverText x={x} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DriverText({ x }) {
  switch (x.kind) {
    case 'pending':
      return (
        <>
          {plural(x.count, 'voucher', 'vouchers')} in review ({formatMoney(x.amount)})
          {x.vouchers.length > 0 && (
            <span className="text-caption">
              {' '}
              ·{' '}
              {x.vouchers.map((v, i) => (
                <span key={v.id}>
                  {i > 0 && ', '}
                  <Link to={reviewPath(v.id)} className="text-primary hover:underline">
                    {v.voucher_number}
                  </Link>
                </span>
              ))}
            </span>
          )}
        </>
      )
    case 'trend': {
      const v = Number(x.per_month)
      if (Math.abs(v) < 1) return 'Spending has been flat month to month'
      return `Spending ${v > 0 ? 'rises' : 'falls'} about ${formatMoney(Math.abs(v))} a month (the trend line)`
    }
    case 'seasonal':
      return `${x.month}: ${formatMoney(x.amount)} approved (${x.vs_average_pct >= 0 ? '+' : ''}${x.vs_average_pct}% vs that year’s monthly average)`
    case 'repeat_payee':
      return `${x.payee} was paid in ${x.month} (${formatMoney(x.amount)}): it may come again`
    default:
      return null
  }
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the forecast" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="flex flex-col gap-3.5 lg:flex-row">
        <div className="h-[260px] flex-1 animate-pulse rounded-xl border bg-card" />
        <div className="h-[260px] w-full animate-pulse rounded-xl border bg-card lg:w-[320px]" />
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Download, Info, RefreshCw, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { exportForecast, getForecasts, recalculateForecasts } from '../api'
import ForecastChart from '../components/ForecastChart'
import HowCalculatedDialog from '../components/HowCalculatedDialog'
import RiskPill from '../components/RiskPill'
import { announceForecastsChanged, FORECASTS_CHANGED_EVENT, forecastPath, MONTH_CHOICES, windowLabel } from '../utils'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * FORECASTS overview (/officer/forecasts?months=1..3; Framer GWmqqOmd7), 2026-11-27.
 * Company spending actual vs forecast + one row per department with its forecast, budget left, confidence and risk.
 * Code differs from the frame: titled "Forecasts" (a linear trend in Laravel, not the AI model yet: same rule as
 * "Flagged"); "accuracy" only appears once a forecast month has ended; departments without 3 months of history say
 * so; a Recalculate button; Export offers CSV / Excel.
 */
export default function ForecastsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const months = MONTH_CHOICES.includes(Number(params.get('months'))) ? Number(params.get('months')) : 3
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(null) // 'recalc' | 'csv' | 'xlsx'
  const [howOpen, setHowOpen] = useState(false)
  const key = `${companyId}|${months}|${attempt}`

  useEffect(() => {
    const ctrl = new AbortController()
    const load = (quiet) =>
      getForecasts(months, { signal: ctrl.signal })
        .then((data) => setState({ key, status: 'success', data, error: null }))
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(FORECASTS_CHANGED_EVENT, refresh)
    return () => {
      ctrl.abort()
      window.removeEventListener(FORECASTS_CHANGED_EVENT, refresh)
    }
  }, [key, months])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null

  const recalc = async () => {
    setBusy('recalc')
    try {
      await recalculateForecasts()
      toast.success('Forecasts worked out again with the latest approvals.')
      announceForecastsChanged()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }
  const download = async (format) => {
    setBusy(format)
    try {
      const name = await exportForecast(months, format)
      toast.success(`Downloaded ${name}`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  const subtitle = d
    ? [
        'Predicted spend by department',
        d.generated_at && `updated ${formatDate(d.generated_at, 'MMM d, yyyy')}`,
        d.accuracy ? `${d.accuracy.pct}% accurate over the last ${d.accuracy.months} months` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Predicted spend by department'

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Forecasts</h1>
          <p className="text-body text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setHowOpen(true)} className={outlineBtn}>
            <Info className="size-4" aria-hidden="true" /> How it’s calculated
          </button>
          <div className="relative">
            <label htmlFor="fc-months" className="sr-only">
              Months ahead
            </label>
            <select
              id="fc-months"
              value={months}
              onChange={(e) => setParams((p) => (p.set('months', e.target.value), p), { replace: true })}
              className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-8 pl-3 outline-none focus:border-primary"
            >
              {MONTH_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? 'Next month' : `Next ${m} months`}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <button
            type="button"
            onClick={recalc}
            disabled={!d || busy}
            className={outlineBtn}
            title="Work the forecasts out again with the latest approvals"
          >
            <RefreshCw className={cn('size-4', busy === 'recalc' && 'animate-spin')} aria-hidden="true" /> Recalculate
          </button>
          <ExportMenu disabled={!d || busy} busy={busy} onPick={download} />
        </div>
      </div>

      {status === 'loading' && <Skeleton />}
      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the forecasts"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {d && !d.next_month && d.rows.every((r) => !r.forecast) && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={TrendingUp}
            title="Not enough history to forecast yet"
            description={`Forecasts need at least ${d.min_months} months of approved vouchers. ${d.company} has ${d.months_used} so far. They appear here by themselves once there's enough.`}
          />
        </div>
      )}

      {d && d.next_month && <CompanyCard d={d} months={months} />}

      {d && d.rows.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-card" aria-label="Forecast by department">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="w-[150px] px-3 py-2.5 text-right font-semibold">
                    {months === 1 ? 'Next month' : `Next ${months} months`}
                  </th>
                  <th className="w-[140px] px-3 py-2.5 text-right font-semibold">Budget left</th>
                  <th className="w-[100px] px-3 py-2.5 text-right font-semibold">Confidence</th>
                  <th className="w-[160px] px-4 py-2.5 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr
                    key={r.department.id}
                    onClick={() => navigate(forecastPath(r.department.id, months))}
                    className={cn(
                      'cursor-pointer border-b last:border-b-0 hover:bg-muted/60',
                      r.risk.level === 'over' && 'bg-danger-soft hover:bg-danger-soft/80',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={forecastPath(r.department.id, months)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-body-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {r.department.name} →
                      </Link>
                      {!r.department.is_active && (
                        <Pill tone="neutral" className="ml-2">
                          Inactive
                        </Pill>
                      )}
                    </td>
                    <td
                      className="text-body-strong px-3 py-3 text-right tabular-nums"
                      title={r.forecast ? `Likely ${formatMoney(r.forecast.lower)} – ${formatMoney(r.forecast.upper)}` : undefined}
                    >
                      {r.forecast ? (
                        formatMoney(r.forecast.predicted)
                      ) : (
                        <span className="text-caption">
                          {r.months_used} of {d.min_months} months
                        </span>
                      )}
                    </td>
                    <td className="text-body px-3 py-3 text-right tabular-nums">
                      {r.risk.budget_left != null ? formatMoney(r.risk.budget_left) : '—'}
                    </td>
                    <td className="text-caption px-3 py-3 text-right tabular-nums">{r.forecast ? `${r.forecast.confidence}%` : '—'}</td>
                    <td className="px-4 py-3">
                      <RiskPill risk={r.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-caption border-t px-4 py-2.5">
            Risk compares what’s still expected until {d.rows.find((r) => r.risk.until)?.risk.until ?? 'the end of the fiscal year'} with
            each department’s budget left. A straight-line trend: one-off purchases and seasons aren’t predicted.
          </p>
        </section>
      )}

      <AnimatePresence>
        {howOpen && <HowCalculatedDialog minMonths={d?.min_months ?? 3} onClose={() => setHowOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

function CompanyCard({ d, months }) {
  const next = d.next_month
  const change =
    d.this_month.forecast && Number(d.this_month.forecast) > 0
      ? Math.round(((Number(next.predicted) - Number(d.this_month.forecast)) / Number(d.this_month.forecast)) * 100)
      : null
  const half = Math.round(((Number(next.upper) - Number(next.lower)) / 2 / Math.max(1, Number(next.predicted))) * 100)
  const windowRow = d.chart.filter((p) => p.kind === 'forecast')
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="fc-company">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="fc-company" className="text-card-title">
            Company spend · actual vs forecast
          </h2>
          <p className="text-caption">
            {next.label} forecast <strong className="font-semibold text-foreground">{formatMoney(next.predicted)}</strong> (±{half}%)
            {change !== null
              ? ` · ${change >= 0 ? '+' : ''}${change}% vs ${formatDate(d.chart.find((p) => p.kind === 'current').month, 'MMMM')}`
              : ''}{' '}
            · {d.months_used} months of history · fit R² {d.r_squared?.toFixed(2)}
          </p>
        </div>
        <p className="text-caption flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-primary bg-primary-soft" aria-hidden="true" /> Forecast
          </span>
        </p>
      </div>
      <ForecastChart
        points={d.chart}
        height={190}
        label={`Company approved spending and the forecast for ${windowLabel(null, months).toLowerCase()}`}
      />
      {windowRow.length > 0 && (
        <p className="text-caption">
          {windowRow.map((p) => `${p.label}: ${p.predicted ? formatMoney(p.predicted) : 'no forecast'}`).join(' · ')}
        </p>
      )}
    </section>
  )
}

function ExportMenu({ disabled, busy, onPick }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={primaryBtn}
      >
        <Download className="size-4" aria-hidden="true" /> {busy === 'csv' || busy === 'xlsx' ? 'Exporting…' : 'Export forecast'}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1.5 flex w-44 flex-col rounded-lg border bg-card p-1 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {[
            ['csv', 'CSV (.csv)'],
            ['xlsx', 'Excel (.xlsx)'],
          ].map(([f, label]) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(f)
              }}
              className="text-body rounded-md px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading forecasts" className="flex flex-col gap-3.5">
      <div className="h-[290px] animate-pulse rounded-xl border bg-card" />
      <div className="h-[260px] animate-pulse rounded-xl border bg-card" />
    </div>
  )
}

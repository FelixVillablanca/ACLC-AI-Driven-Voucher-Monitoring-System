import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays, Check, Info, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { compactMoney, pctText, UsageBar, usageTone } from '@/features/budgets'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getSupervisorBudgets } from '../api'
import BudgetChangeDialog from '../components/BudgetChangeDialog'
import { announceDecisionsChanged, outlineBtn } from '../utils'

const TONE_TEXT = { danger: 'text-danger', warning: 'text-warning', primary: 'text-primary', success: 'text-success' }

/**
 * BUDGETS for the Supervisor / Manager (/supervisor/budgets; Framer adI8wBXHd overview + KHqkVA77a approve top-up),
 * 2026-11-27. Read-only department budgets of a fiscal year (the same numbers Accounting sees) and Accounting's budget
 * changes waiting for a Supervisor's sign-off (any fiscal year). ?year= picks the year; ?request={id}[&mode=decline]
 * opens the sign-off window (the bell's "Budget change needs your sign-off" lands here).
 * Code differs from the frame: "Forecasts" (not "AI forecasts"); departments without a budget
 * are listed; a request that LOWERS a budget shows "−"; the footer uses the real sign-off amount from Global settings.
 */
export default function SupervisorBudgetsPage() {
  usePageTitle('Budgets')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const year = Number(params.get('year')) || null
  const openId = Number(params.get('request')) || null
  const openMode = params.get('mode') === 'decline' ? 'decline' : 'approve'
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([companyId, year, attempt])

  useEffect(() => {
    let alive = true
    getSupervisorBudgets({ year })
      .then((data) => alive && setState({ key, status: 'success', data, error: null }))
      .catch((error) => alive && setState({ key, status: 'error', data: null, error }))
    return () => {
      alive = false
    }
  }, [key, year])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const s = d?.summary
  const open = d && openId ? d.requests.find((r) => r.id === openId) : null

  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, String(v))))
        return p
      },
      { replace: true },
    )
  const close = () => setParam({ request: null, mode: null })
  const reload = () => {
    announceDecisionsChanged() // the sidebar's request count
    setAttempt((n) => n + 1)
  }

  // a link to a request that is no longer waiting (decided elsewhere, or a stale bell notice)
  useEffect(() => {
    if (d && openId && !open) {
      toast('That budget change isn’t waiting any more.', { icon: 'ℹ️' })
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, openId, open])

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Budgets</h1>
          <p className="text-body text-muted-foreground">
            {d
              ? `${d.label} allocations across all departments · ${d.company}`
              : 'Department budgets and changes waiting for your sign-off'}
          </p>
        </div>
        {d && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <label htmlFor="sv-budget-year" className="sr-only">
                Fiscal year
              </label>
              <select
                id="sv-budget-year"
                value={d.fiscal_year}
                onChange={(e) => setParam({ year: Number(e.target.value) === d.current_year ? null : e.target.value })}
                className={cn(inputClass, 'h-[38px] w-auto pr-8 pl-9')}
              >
                {d.years.map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
            <Link to={PATHS.SUPERVISOR_FORECASTS} className={outlineBtn}>
              <TrendingUp className="size-4" aria-hidden="true" /> Forecasts
            </Link>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load budgets"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'loading' && (
        <div role="status" aria-label="Loading budgets" className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
          <div className="flex flex-col gap-3.5 lg:flex-row">
            <div className="h-[360px] flex-1 animate-pulse rounded-xl border bg-card" />
            <div className="h-[360px] animate-pulse rounded-xl border bg-card lg:w-[400px]" />
          </div>
        </div>
      )}

      {d && (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Card
              label="Total allocated"
              value={compactMoney(s.total_allocated)}
              title={formatMoney(s.total_allocated)}
              caption={s.departments ? plural(s.departments, 'department', 'departments') : 'No budgets set for this year'}
            />
            <Card
              label="Used so far"
              value={compactMoney(s.used)}
              title={formatMoney(s.used)}
              caption={
                s.departments
                  ? `${pctText(s.used_pct)}${d.period.state === 'current' ? ` · ${d.period.elapsed_pct}% of the year gone` : d.period.state === 'past' ? ' · year closed' : ''}`
                  : ' '
              }
            />
            <Card
              label="Requests waiting for you"
              value={d.requests.length}
              tone={d.requests.length ? 'warning' : undefined}
              caption={
                d.requests.length
                  ? Number(d.requests_up_total) > 0
                    ? `${formatMoney(d.requests_up_total)} in top-ups`
                    : 'Budget changes to sign off'
                  : 'Nothing waiting'
              }
            />
          </div>

          <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
            <section className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card" aria-labelledby="sv-by-dept">
              <h2 id="sv-by-dept" className="text-card-title border-b px-5 py-3.5">
                By department
              </h2>
              {d.rows.length === 0 ? (
                <p className="text-caption px-5 py-6">This company has no departments yet.</p>
              ) : (
                <ul>
                  {d.rows.map((row) => {
                    const b = row.budget
                    const tone = b ? usageTone(b.used_pct, b.alert_pct) : null
                    return (
                      <li key={row.department.id} className="flex flex-col gap-2 border-b px-5 py-3.5 last:border-b-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-body-strong">
                            {row.department.name}
                            {!row.department.is_active && <span className="text-caption"> · inactive</span>}
                          </span>
                          {b ? (
                            <span className="text-caption flex items-center gap-2">
                              <span className="tabular-nums" title={`${formatMoney(b.used)} of ${formatMoney(b.total)}`}>
                                {compactMoney(b.used)} of {compactMoney(b.total)}
                              </span>
                              <span className={cn('text-badge tabular-nums', TONE_TEXT[tone])}>
                                {pctText(b.used_pct)}
                                {b.over_alert ? ' · alert' : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-caption">No budget set</span>
                          )}
                        </div>
                        {b && <UsageBar pct={b.used_pct} alertPct={b.alert_pct} label={`${row.department.name} budget used`} />}
                        {b?.pending_request && (
                          <span className="text-caption text-warning">
                            Change to {formatMoney(b.pending_request.requested_budget)} waiting for sign-off
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="flex w-full flex-col rounded-xl border bg-card lg:w-[400px] lg:shrink-0" aria-labelledby="sv-requests">
              <h2 id="sv-requests" className="text-card-title flex items-center justify-between gap-2 border-b px-5 py-3.5">
                Budget change requests
                {d.requests.length > 0 && <Pill tone="warning">{d.requests.length} waiting</Pill>}
              </h2>
              {d.requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <div className="flex size-11 items-center justify-center rounded-full bg-success-soft">
                    <Check className="size-5 text-success" aria-hidden="true" />
                  </div>
                  <p className="text-body-strong">Nothing waiting for your sign-off</p>
                  <p className="text-caption max-w-[280px]">When Accounting asks for a big budget change, it appears here.</p>
                </div>
              ) : (
                <ul>
                  {d.requests.map((r) => {
                    const up = !r.change.startsWith('-')
                    return (
                      <li key={r.id} className="flex flex-col gap-2 border-b px-5 py-3.5 last:border-b-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-body-strong">
                            {r.department.name}
                            {r.fiscal_year !== d.current_year && <span className="text-caption"> · {r.fiscal_label}</span>}
                          </span>
                          <span className={cn('text-card-title tabular-nums', up ? 'text-primary' : 'text-warning')}>
                            {up ? '+ ' : '− '}
                            {formatMoney(r.change.replace('-', ''))}
                          </span>
                        </div>
                        <p className="text-caption">
                          From {r.requested_by ?? 'Accounting'} · {formatDate(r.created_at, 'MMM d')} · “{r.reason}”
                        </p>
                        {r.mine ? (
                          <p className="text-caption">You asked for this one: another Supervisor decides.</p>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setParam({ request: r.id, mode: null })}
                              className="text-auth-button flex h-[34px] flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => setParam({ request: r.id, mode: 'decline' })}
                              className={cn(outlineBtn, 'h-[34px] flex-1 text-danger')}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <p className="text-caption flex items-start gap-2 rounded-xl border bg-primary-faint px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Accounting sets the budgets. A change of more than {formatMoney(d.signoff_above)} waits for a Supervisor&apos;s approval
              before it applies.
            </span>
          </p>
        </>
      )}

      <AnimatePresence>
        {open && (
          <BudgetChangeDialog
            key={`${open.id}-${openMode}`}
            request={open}
            initialMode={openMode}
            onClose={close}
            onDone={(message) => {
              toast.success(message)
              close()
              reload()
            }}
            onConflict={(e) => {
              toast.error(e.message, { duration: 7000 })
              close()
              reload()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Card({ label, value, caption, tone, title }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-[18px] py-4">
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'warning' && 'text-warning')} title={title}>
        {value}
      </span>
      <span className="text-caption">{caption}</span>
    </div>
  )
}

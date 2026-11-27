import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Hourglass, PieChart, Plus, SquarePen } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getBudgets } from '../api'
import BudgetFormModal from '../components/BudgetFormModal'
import UsageBar from '../components/UsageBar'
import { BUDGETS_CHANGED_EVENT, budgetPath, compactMoney, pctText, TONE_TEXT, usageTone } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * BUDGETS overview (/officer/budgets; Framer AwnFnuBYJ), 2026-11-27. Yearly department budgets of the company in
 * the switcher. ?year= picks the fiscal year, ?allocate=1 opens "+ Allocate budget", ?edit={departmentId} opens
 * Edit allocation (Framer MGf9CXv2s) for that row. A row opens the department page.
 * Code differs from the frame: departments without a budget are listed too (with "Allocate"); a row shows
 * "Change waiting" while a sign-off request is open; "Pending vouchers" = vouchers still in review.
 */
export default function BudgetsPage() {
  usePageTitle('Budgets')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const year = Number(params.get('year')) || null
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${companyId}|${year}|${attempt}`

  useEffect(() => {
    const ctrl = new AbortController()
    const load = (quiet) =>
      getBudgets(year, { signal: ctrl.signal })
        .then((data) => setState({ key, status: 'success', data, error: null }))
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(BUDGETS_CHANGED_EVENT, refresh)
    return () => {
      ctrl.abort()
      window.removeEventListener(BUDGETS_CHANGED_EVENT, refresh)
    }
  }, [key, year])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, v)))
        return p
      },
      { replace: true },
    )

  const editRow = d && params.get('edit') ? d.rows.find((r) => String(r.department.id) === params.get('edit') && r.budget) : null
  const allocating = d && params.get('allocate') === '1'
  const unallocated = d ? d.rows.filter((r) => !r.budget && r.department.is_active).map((r) => r.department) : []
  const preselect = allocating && params.get('department') ? unallocated.find((x) => String(x.id) === params.get('department')) : null

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Budgets</h1>
          <p className="text-body text-muted-foreground">
            {d ? `Department allocations for ${d.company} · ${d.label}` : 'Department allocations'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <label htmlFor="budget-year" className="sr-only">
              Fiscal year
            </label>
            <select
              id="budget-year"
              value={d?.fiscal_year ?? ''}
              disabled={!d}
              onChange={(e) => setParam({ year: e.target.value, edit: null, allocate: null })}
              className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-8 pl-3 outline-none focus:border-primary"
            >
              {(d?.years ?? []).map((y) => (
                <option key={y.year} value={y.year}>
                  {y.label}
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
            disabled={!d?.can_allocate}
            title={d && !d.can_allocate ? `Every active department already has a ${d.label} budget` : undefined}
            onClick={() => setParam({ allocate: '1' })}
            className={primaryBtn}
          >
            <Plus className="size-4" aria-hidden="true" /> Allocate budget
          </button>
        </div>
      </div>

      {status === 'loading' && <Skeleton />}
      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the budgets"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {d && (
        <>
          <Cards d={d} />
          {d.rows.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={PieChart}
                title="No departments yet"
                description="Budgets are set per department. Your company's Admin adds departments; they'll appear here."
              />
            </div>
          ) : (
            <BudgetTable
              d={d}
              onEdit={(id) => setParam({ edit: id })}
              onAllocate={(id) => setParam({ allocate: '1', department: id })}
              navigate={navigate}
            />
          )}
        </>
      )}

      <AnimatePresence>
        {editRow && (
          <BudgetFormModal
            key="edit"
            mode="edit"
            department={editRow.department}
            budget={editRow.budget}
            year={d.fiscal_year}
            yearLabel={d.label}
            signoffAbove={d.signoff_above}
            onClose={() => setParam({ edit: null })}
            onSaved={() => setParam({ edit: null })}
          />
        )}
        {allocating && (
          <BudgetFormModal
            key="allocate"
            mode="create"
            department={preselect}
            departments={unallocated}
            year={d.fiscal_year}
            yearLabel={d.label}
            signoffAbove={d.signoff_above}
            onClose={() => setParam({ allocate: null, department: null })}
            onSaved={() => setParam({ allocate: null, department: null })}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Cards({ d }) {
  const s = d.summary
  const elapsed =
    d.period.state === 'current'
      ? `${d.period.elapsed_pct}% of year elapsed`
      : d.period.state === 'past'
        ? 'Year finished'
        : 'Year not started'
  const over = s.over_alert > 0
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total allocated" value={compactMoney(s.total_allocated)} title={formatMoney(s.total_allocated)}>
        {s.departments ? plural(s.departments, 'department', 'departments') : 'No budgets set yet'}
      </Card>
      <Card label="Used to date" value={compactMoney(s.used)} title={formatMoney(s.used)}>
        <span className="text-badge text-primary">
          {s.departments ? `${pctText(s.used_pct)} · ` : ''}
          {elapsed}
        </span>
      </Card>
      <Card label="Remaining" value={compactMoney(s.remaining)} title={formatMoney(s.remaining)}>
        {s.pending_amount == null
          ? 'Only this year has vouchers in review'
          : s.pending_count
            ? `Pending vouchers: ${compactMoney(s.pending_amount)} (${s.pending_count})`
            : 'No vouchers in review'}
      </Card>
      <Card label="Over alert threshold" value={s.over_alert} danger={over}>
        {over
          ? `${s.over_alert_first.name} at ${pctText(s.over_alert_first.used_pct)}${s.over_alert > 1 ? ` + ${s.over_alert - 1} more` : ''}`
          : 'All within their alert'}
      </Card>
    </div>
  )
}

function Card({ label, value, title, danger, children }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5', danger ? 'border-danger bg-danger-soft' : 'bg-card')}>
      <span className={cn('text-caption', danger && 'text-badge text-danger')}>{label}</span>
      <span className="text-stat-value tabular-nums" title={title}>
        {value}
      </span>
      <span className="text-caption">{children}</span>
    </div>
  )
}

function BudgetTable({ d, onEdit, onAllocate, navigate }) {
  const open = (id) => navigate(budgetPath(id, d.fiscal_year, d.current_year))
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={`${d.label} department budgets`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Department</th>
              <th className="w-[150px] px-3 py-2.5 text-right font-semibold">Allocated</th>
              <th className="w-[150px] px-3 py-2.5 text-right font-semibold">Used</th>
              <th className="px-3 py-2.5 font-semibold">Usage</th>
              <th className="w-[80px] px-3 py-2.5 font-semibold">Alert at</th>
              <th className="w-[96px] px-4 py-2.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map(({ department, budget }) => {
              const tone = budget ? usageTone(budget.used_pct, budget.alert_pct) : null
              return (
                <tr
                  key={department.id}
                  onClick={() => open(department.id)}
                  className={cn(
                    'cursor-pointer border-b last:border-b-0 hover:bg-muted/60',
                    budget?.over_alert && 'bg-danger-soft hover:bg-danger-soft/80',
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={budgetPath(department.id, d.fiscal_year, d.current_year)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-body-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {department.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {!department.is_active && <Pill tone="neutral">Inactive</Pill>}
                      {budget?.pending_request && (
                        <Pill tone="warning">
                          <Hourglass className="mr-1 size-3" aria-hidden="true" />
                          Change waiting for sign-off
                        </Pill>
                      )}
                    </div>
                  </td>
                  {budget ? (
                    <>
                      <td className="text-body px-3 py-3 text-right tabular-nums">{formatMoney(budget.total)}</td>
                      <td className="text-body-strong px-3 py-3 text-right tabular-nums">{formatMoney(budget.used)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <UsageBar
                            pct={budget.used_pct}
                            alertPct={budget.alert_pct}
                            label={`${department.name} budget used`}
                            className="flex-1"
                          />
                          <span className={cn('text-badge w-12 text-right tabular-nums', TONE_TEXT[tone])}>{pctText(budget.used_pct)}</span>
                        </div>
                      </td>
                      <td className="text-caption px-3 py-3">{pctText(budget.alert_pct)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(department.id)
                          }}
                          disabled={Boolean(budget.pending_request)}
                          title={budget.pending_request ? 'A change is already waiting for sign-off' : 'Edit allocation'}
                          aria-label={`Edit ${department.name} allocation`}
                          className="ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <SquarePen className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={4} className="text-caption px-3 py-3">
                        No {d.label} budget yet
                      </td>
                      <td className="px-4 py-3 text-right">
                        {department.is_active && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAllocate(department.id)
                            }}
                            className={cn(outlineBtn, 'ml-auto h-8 px-3')}
                          >
                            Allocate
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-caption border-t px-4 py-2.5">
        Used = vouchers with their final approval. Edits bigger than {formatMoney(d.signoff_above)} need a Supervisor’s sign-off.
      </p>
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading budgets" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-[320px] animate-pulse rounded-xl border bg-card" />
    </div>
  )
}

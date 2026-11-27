import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ArrowLeft, Hourglass, History, PieChart, Plus, Settings2, SquarePen, TriangleAlert } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { reviewPath } from '@/features/approvals'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { cancelBudgetRequest, getDepartmentBudget } from '../api'
import BudgetFormModal from '../components/BudgetFormModal'
import UsageBar from '../components/UsageBar'
import { announceBudgetsChanged, BUDGETS_CHANGED_EVENT, compactMoney, pctText, TONE_BAR, usageTone } from '../utils'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * ONE DEPARTMENT'S BUDGET (/officer/budgets/:departmentId?year=; Framer kpJmhDxKE), 2026-11-27. ?edit=1 opens Edit
 * allocation (Framer MGf9CXv2s), ?allocate=1 sets a first budget for the year.
 * Real data only. Code differs from the frame: the "✦ AI forecast" box is a Change history list (no forecasting
 * model yet); a change waiting for Supervisor sign-off shows as an amber box (with Cancel for the officer who
 * asked); the monthly chart shows approved spending, with this month's vouchers in review on top in amber.
 */
export default function DepartmentBudgetPage() {
  const { departmentId } = useParams()
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const year = Number(params.get('year')) || null
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [cancelling, setCancelling] = useState(null) // null | { busy, error }
  const key = `${companyId}|${departmentId}|${year}|${attempt}`

  useEffect(() => {
    const ctrl = new AbortController()
    const load = (quiet) =>
      getDepartmentBudget(departmentId, year, { signal: ctrl.signal })
        .then((data) => setState({ key, status: 'success', data, error: null }))
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(BUDGETS_CHANGED_EVENT, refresh)
    return () => {
      ctrl.abort()
      window.removeEventListener(BUDGETS_CHANGED_EVENT, refresh)
    }
  }, [key, departmentId, year])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const b = d?.budget
  const setParam = (k, v) =>
    setParams(
      (p) => {
        if (v == null) p.delete(k)
        else p.set(k, v)
        return p
      },
      { replace: true },
    )
  const backTo = `${PATHS.OFFICER_BUDGETS}${d && d.fiscal_year !== d.current_year ? `?year=${d.fiscal_year}` : ''}`

  const cancelRequest = async () => {
    setCancelling({ busy: true, error: null })
    try {
      await cancelBudgetRequest(d.request.id)
      toast.success('Your change request was cancelled. The budget stays as it is.')
      setCancelling(null)
      announceBudgetsChanged()
    } catch (error) {
      setCancelling({ busy: false, error })
      if (error.code === 'REQUEST_ALREADY_DECIDED') announceBudgetsChanged()
    }
  }

  if (status === 'error') {
    const missing = state.error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
        <BackLink to={PATHS.OFFICER_BUDGETS} />
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={missing ? 'Department not found' : "Couldn't load this budget"}
            message={missing ? 'It isn’t a department of the company you’re working in. Pick one from Budgets.' : state.error.message}
            requestId={missing ? undefined : state.error.requestId}
            onRetry={missing ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">{d ? `${d.department.name} budget` : 'Department budget'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink to={backTo} inline />
            {d && (
              <span>
                / {d.label} · {d.department.head ? `Head: ${d.department.head}` : 'No department head'} ·{' '}
                {plural(d.department.vouchers_this_month, 'voucher', 'vouchers')} this month
              </span>
            )}
          </p>
        </div>
        {b && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setParam('edit', '1')} disabled={Boolean(d.request)} className={outlineBtn}>
              <Settings2 className="size-4" aria-hidden="true" /> Alert at {pctText(b.alert_pct)}
            </button>
            <button
              type="button"
              onClick={() => setParam('edit', '1')}
              disabled={Boolean(d.request)}
              title={d.request ? 'A change is already waiting for sign-off' : undefined}
              className={primaryBtn}
            >
              <SquarePen className="size-4" aria-hidden="true" /> Edit allocation
            </button>
          </div>
        )}
      </div>

      {status === 'loading' && <Skeleton />}

      {d && !b && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={PieChart}
            title={`No ${d.label} budget for ${d.department.name}`}
            description={
              d.department.is_active
                ? 'Set a yearly budget so Accounting can see how much is used and get alerts before it runs out.'
                : 'This department is inactive, so it can’t get a new budget.'
            }
            action={
              d.department.is_active && (
                <button type="button" onClick={() => setParam('allocate', '1')} className={primaryBtn}>
                  <Plus className="size-4" aria-hidden="true" /> Allocate budget
                </button>
              )
            }
          />
        </div>
      )}

      {b && (
        <>
          {d.request && <RequestBox r={d.request} onCancel={() => setCancelling({ busy: false, error: null })} />}
          <Numbers d={d} />
        </>
      )}

      {d && (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
          <MonthlySpend d={d} />
          <div className="flex w-full flex-col gap-3.5 lg:w-[320px] lg:shrink-0">
            <Categories categories={d.categories} label={d.label} />
            {b && <HistoryCard history={d.history} />}
          </div>
        </div>
      )}

      <AnimatePresence>
        {d && b && params.get('edit') === '1' && !d.request && (
          <BudgetFormModal
            key="edit"
            mode="edit"
            department={d.department}
            budget={b}
            year={d.fiscal_year}
            yearLabel={d.label}
            signoffAbove={d.signoff_above}
            onClose={() => setParam('edit', null)}
            onSaved={() => setParam('edit', null)}
          />
        )}
        {d && !b && params.get('allocate') === '1' && d.department.is_active && (
          <BudgetFormModal
            key="allocate"
            mode="create"
            department={d.department}
            departments={[d.department]}
            year={d.fiscal_year}
            yearLabel={d.label}
            signoffAbove={d.signoff_above}
            onClose={() => setParam('allocate', null)}
            onSaved={() => setParam('allocate', null)}
          />
        )}
        {cancelling && d?.request && (
          <ConfirmDialog
            key="cancel"
            title="Cancel your change request?"
            description={`The ${d.label} budget stays ${formatMoney(d.request.current_budget)}. The Supervisor won't be asked any more.`}
            confirmLabel="Cancel request"
            cancelLabel="Keep it"
            tone="danger"
            busy={cancelling.busy}
            error={cancelling.error}
            onConfirm={cancelRequest}
            onCancel={() => setCancelling(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink({ to, inline }) {
  return (
    <Link to={to} className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}>
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Budgets
    </Link>
  )
}

function Numbers({ d }) {
  const b = d.budget
  const tone = usageTone(b.used_pct, b.alert_pct)
  const pending = d.pending
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-label="Budget numbers">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Figure label="Allocated" value={formatMoney(b.total)} />
        <Figure label="Used" value={formatMoney(b.used)} />
        <Figure
          label="Pending in queue"
          value={pending ? formatMoney(pending.amount) : '—'}
          hint={pending ? plural(pending.count, 'voucher in review', 'vouchers in review') : 'Only for this year'}
        />
        <Figure label="Remaining" value={formatMoney(b.remaining)} danger={b.over_alert || Number(b.remaining) < 0} />
      </div>
      <UsageBar
        pct={b.used_pct}
        alertPct={b.alert_pct}
        pendingPct={pending && Number(pending.amount) > 0 ? b.after_pending_pct : null}
        size="lg"
        label={`${d.department.name} budget used`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', TONE_BAR[tone])} aria-hidden="true" /> Used {pctText(b.used_pct)}
          </span>
          {pending && Number(pending.amount) > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-warning/70" aria-hidden="true" /> Pending would reach {pctText(b.after_pending_pct)}
            </span>
          )}
          <span>Alert at {pctText(b.alert_pct)}</span>
        </p>
        {b.over_alert && (
          <p className="text-badge flex items-center gap-1 text-danger">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Over the {pctText(b.alert_pct)} alert threshold{b.alert_since ? ` since ${formatDate(b.alert_since, 'MMM d')}` : ''}
          </p>
        )}
      </div>
    </section>
  )
}

function Figure({ label, value, hint, danger }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption">{label}</span>
      <span className={cn('text-card-title truncate tabular-nums', danger && 'text-danger')}>{value}</span>
      {hint && <span className="text-caption">{hint}</span>}
    </div>
  )
}

function RequestBox({ r, onCancel }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3" role="status">
      <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-strong">
          Change waiting for Supervisor sign-off: {formatMoney(r.current_budget)} → {formatMoney(r.requested_budget)}
          {r.requested_alert_pct !== r.current_alert_pct
            ? ` · alert ${pctText(r.current_alert_pct)} → ${pctText(r.requested_alert_pct)}`
            : ''}
        </p>
        <p className="text-caption">
          Asked by {r.mine ? 'you' : (r.requested_by ?? 'an officer')} {r.created_at ? formatTimeAgo(r.created_at) : ''} · “{r.reason}”.
          Nothing changes until it’s approved.
        </p>
      </div>
      {r.mine && (
        <button type="button" onClick={onCancel} className={cn(outlineBtn, 'h-8 px-3')}>
          Cancel request
        </button>
      )}
    </div>
  )
}

/** Approved spending per month of the fiscal year; this month's vouchers in review stacked on top (amber). */
function MonthlySpend({ d }) {
  const pendingC = d.pending ? Number(d.pending.amount) : 0
  const max = Math.max(1, ...d.monthly.map((m) => Number(m.approved) + (m.is_current ? pendingC : 0)))
  const total = d.monthly.reduce((s, m) => s + Number(m.approved), 0)
  const last = d.monthly.filter((m) => !m.is_future).at(-1)
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="monthly-spend">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="monthly-spend" className="text-card-title">
          Monthly spend · {d.label}
        </h2>
        <span className="text-caption tabular-nums">{formatMoney(total)} approved</span>
      </div>
      {total === 0 && pendingC === 0 ? (
        <p className="text-caption py-10 text-center">
          Nothing approved for {d.department.name} in {d.label} yet.
        </p>
      ) : (
        <div className="flex h-[180px] items-end gap-1.5" role="img" aria-label={`Approved spending per month in ${d.label}`}>
          {d.monthly.map((m) => {
            const a = Number(m.approved)
            const p = m.is_current ? pendingC : 0
            return (
              <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="flex w-full flex-col justify-end overflow-hidden rounded-t-md"
                  style={{ height: `${((a + p) / max) * 100}%`, minHeight: a + p > 0 ? 3 : 0 }}
                  title={`${m.label}: ${formatMoney(m.approved)} approved${p ? ` + ${formatMoney(p)} in review` : ''}`}
                >
                  {p > 0 && <div className="w-full bg-warning/70" style={{ height: `${(p / (a + p)) * 100}%` }} />}
                  {a > 0 && <div className={cn('w-full flex-1', m.is_current ? 'bg-primary' : 'bg-primary/30')} />}
                </div>
                <span
                  className={cn(
                    'text-[11px] text-muted-foreground',
                    m.is_current && 'font-semibold text-foreground',
                    m.is_future && 'opacity-50',
                  )}
                >
                  {m.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-caption">
        {d.monthly[0].label} → {last?.label ?? d.monthly[0].label}
        {d.pending && d.pending.count > 0 && (
          <>
            {' '}
            · this month also has {plural(d.pending.count, 'voucher', 'vouchers')} in review:{' '}
            {d.pending.top.map((v, i) => (
              <span key={v.id}>
                {i > 0 && ', '}
                <Link to={reviewPath(v.id)} className="text-primary hover:underline">
                  {v.voucher_number}
                </Link>{' '}
                ({formatMoney(v.amount)})
              </span>
            ))}
            {d.pending.count > d.pending.top.length && ' …'}
          </>
        )}
      </p>
    </section>
  )
}

function Categories({ categories, label }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="by-category">
      <h2 id="by-category" className="text-card-title">
        By category
      </h2>
      {categories.length === 0 ? (
        <p className="text-caption">No approved spending in {label} yet.</p>
      ) : (
        categories.map((c) => (
          <div key={c.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-body truncate">{c.name}</span>
              <span className="text-body-strong tabular-nums" title={formatMoney(c.amount)}>
                {compactMoney(c.amount)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.pct)}%` }} />
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function HistoryCard({ history }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="budget-history">
      <div className="flex items-center justify-between gap-2">
        <h2 id="budget-history" className="text-card-title">
          Change history
        </h2>
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      {history.length === 0 ? (
        <p className="text-caption">No changes yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {history.map((h) => (
            <li key={h.id} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
              <span className="text-body-strong">{h.label}</span>
              {h.to && (
                <span className="text-caption tabular-nums">
                  {h.from ? `${formatMoney(h.from.total)} → ` : ''}
                  {formatMoney(h.to.total)}
                  {h.from && h.from.alert_pct !== h.to.alert_pct
                    ? ` · alert ${pctText(h.from.alert_pct)} → ${pctText(h.to.alert_pct)}`
                    : ''}
                </span>
              )}
              {h.reason && <span className="text-caption italic">“{h.reason}”</span>}
              <span className="text-caption">
                {h.by} · {formatTimeAgo(h.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the budget" className="flex flex-col gap-3.5">
      <div className="h-[150px] animate-pulse rounded-xl border bg-card" />
      <div className="flex flex-col gap-3.5 lg:flex-row">
        <div className="h-[260px] flex-1 animate-pulse rounded-xl border bg-card" />
        <div className="h-[260px] w-full animate-pulse rounded-xl border bg-card lg:w-[320px]" />
      </div>
    </div>
  )
}

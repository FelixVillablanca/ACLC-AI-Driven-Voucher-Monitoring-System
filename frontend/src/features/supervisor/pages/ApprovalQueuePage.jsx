import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CheckCheck, ChevronDown, History, Info, Search, SearchX } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { bulkFinalApprove, listLevel2Queue } from '../api'
import { useSupervisorSummary } from '../hooks/useSupervisorSummary'
import { announceDecisionsChanged, daysWaiting, DECISIONS_CHANGED_EVENT, LEVEL2_SORTS, LEVEL2_VIEWS, level2Path, shortName } from '../utils'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * APPROVAL QUEUE (/supervisor, the Supervisor's landing page; Framer RRXP4iCfd list, WAk4RKdFc cleared), 2026-11-27.
 * Every voucher that passed Level 1 and waits for final approval (`under_review`) in the company in the switcher,
 * oldest first. Tabs / search / sort / page in the address (?view=&q=&sort=&page=). "Approve selected" = bulk final
 * approval (flagged vouchers can't be picked). Reloads after a decision and every 60 s.
 * Code differs from the frames: no "Escalated" tab (officers can't escalate by hand); the row shows category · payee
 * (no item description in the queue); the cleared state links to Decision history (no Supervisor dashboard or
 * budgets page yet).
 */
export default function ApprovalQueuePage() {
  usePageTitle('Approval queue')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const { data: summary } = useSupervisorSummary()
  const view = params.get('view') ?? null
  const sort = params.get('sort') ?? 'oldest'
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounce(search.trim(), 350)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState([])
  const [bulk, setBulk] = useState(null) // null | { busy, error }
  const key = `${companyId}|${view}|${sort}|${q}|${page}|${attempt}`

  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, v)))
        return p
      },
      { replace: true },
    )
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParam({ q, page: null })
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController()
    const load = (quiet) =>
      listLevel2Queue({ view, search: q, sort, page, signal: ctrl.signal })
        .then((data) => {
          setState({ key, status: 'success', data, error: null })
          setSelected((s) => s.filter((id) => data.vouchers.some((v) => v.id === id)))
        })
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(DECISIONS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      ctrl.abort()
      window.removeEventListener(DECISIONS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
  }, [key, view, sort, q, page])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const total = d?.meta.counts.all ?? 0
  const filtered = Boolean(view || q)
  const cleared = d && !filtered && total === 0
  const pickable = d ? d.vouchers.filter((v) => !v.ai.flagged) : []
  const picked = d ? d.vouchers.filter((v) => selected.includes(v.id)) : []
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const approveSelected = async () => {
    setBulk({ busy: true, error: null })
    try {
      const r = await bulkFinalApprove(selected)
      toast.success(`${plural(r.approved, 'voucher', 'vouchers')} approved and released for payment.`)
      setBulk(null)
      setSelected([])
      announceDecisionsChanged()
    } catch (error) {
      setBulk({ busy: false, error })
      if (error.code === 'BULK_NOT_ALLOWED') announceDecisionsChanged()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Approval queue</h1>
          <p className="text-body text-muted-foreground">
            {!d
              ? 'Vouchers waiting for your final approval'
              : total === 0
                ? '0 vouchers waiting for final approval'
                : `${plural(total, 'voucher', 'vouchers')} passed Level 1 and ${total === 1 ? 'needs' : 'need'} your final approval · ${formatMoney(summary?.queue.total_amount ?? d.meta.total_amount)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!cleared && (
            <div className="relative">
              <label htmlFor="l2-sort" className="sr-only">
                Sort
              </label>
              <select
                id="l2-sort"
                value={sort}
                onChange={(e) => setParam({ sort: e.target.value === 'oldest' ? null : e.target.value, page: null })}
                className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-8 pl-3 outline-none focus:border-primary"
              >
                {LEVEL2_SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    ⇅ {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          )}
          {selected.length > 0 ? (
            <button type="button" onClick={() => setBulk({ busy: false, error: null })} className={primaryBtn}>
              <CheckCheck className="size-4" aria-hidden="true" /> Approve selected ({selected.length})
            </button>
          ) : (
            <Link to={PATHS.SUPERVISOR_HISTORY} className={cleared ? primaryBtn : outlineBtn}>
              <History className="size-4" aria-hidden="true" /> Decision history
            </Link>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the approval queue"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}
      {status === 'loading' && !d && <Skeleton />}

      {cleared && <Cleared firstName={user?.first_name} today={summary?.today} />}

      {d && !cleared && (
        <section className="overflow-hidden rounded-xl border bg-card" aria-label="Vouchers waiting for final approval">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b px-4 py-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Queue views">
              {LEVEL2_VIEWS.map((t) => {
                const on = (view ?? null) === t.key
                return (
                  <button
                    key={t.label}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setParam({ view: t.key, page: null })}
                    className={cn(
                      'text-body-strong h-8 rounded-lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      on
                        ? t.tone === 'danger'
                          ? 'bg-danger-soft text-danger'
                          : 'bg-primary-soft text-primary'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {t.label} · {d.meta.counts[t.count] ?? 0}
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Voucher no., payee, clerk…"
                aria-label="Search the queue"
                className="text-body h-9 w-[240px] rounded-lg border bg-card pr-3 pl-8 outline-none focus:border-primary"
              />
            </div>
          </div>

          {d.vouchers.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No vouchers match"
              description="Try another tab or search."
              action={
                <button type="button" onClick={() => (setSearch(''), setParam({ view: null, q: null, page: null }))} className={outlineBtn}>
                  Show all
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead className="border-b bg-muted">
                  <tr className="text-table-head text-muted-foreground">
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select every normal voucher on this page"
                        checked={pickable.length > 0 && pickable.every((v) => selected.includes(v.id))}
                        disabled={pickable.length === 0}
                        onChange={(e) => setSelected(e.target.checked ? pickable.map((v) => v.id) : [])}
                        className="size-4 accent-primary"
                      />
                    </th>
                    <th className="px-2 py-2.5 font-semibold">Voucher</th>
                    <th className="w-[140px] px-3 py-2.5 font-semibold">Department</th>
                    <th className="w-[130px] px-3 py-2.5 text-right font-semibold">Amount</th>
                    <th className="w-[130px] px-3 py-2.5 font-semibold">Why Level 2</th>
                    <th className="w-[130px] px-3 py-2.5 font-semibold">Level 1</th>
                    <th className="w-[90px] px-4 py-2.5 font-semibold">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {d.vouchers.map((v) => {
                    const on = selected.includes(v.id)
                    return (
                      <tr
                        key={v.id}
                        onClick={() => navigate(level2Path(v.id))}
                        className={cn(
                          'cursor-pointer border-b last:border-b-0 hover:bg-muted/60',
                          v.ai.flagged && 'bg-danger-soft/60',
                          on && 'bg-primary-faint',
                        )}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={v.ai.flagged}
                            onChange={() => toggle(v.id)}
                            title={v.ai.flagged ? 'Flagged vouchers can’t be bulk-approved' : undefined}
                            aria-label={`Select ${v.voucher_number}`}
                            className="size-4 accent-primary disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <Link
                            to={level2Path(v.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-body-strong text-primary hover:underline"
                          >
                            {v.voucher_number}
                          </Link>
                          <p className="text-caption truncate">{[v.category, v.payee_name].filter(Boolean).join(' · ') || '—'}</p>
                        </td>
                        <td className="text-body px-3 py-3">{v.department ?? '—'}</td>
                        <td className="text-body-strong px-3 py-3 text-right tabular-nums">{formatMoney(v.amount)}</td>
                        <td className="px-3 py-3">
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
                        <td className="text-caption px-3 py-3">
                          {v.level1 ? `${shortName(v.level1.by)} · ${formatDate(v.level1.at, 'MMM d')}` : '—'}
                        </td>
                        <td className="text-body px-4 py-3">{daysWaiting(v.level1?.at ?? v.submitted_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t px-4 py-2.5">
            <p className="text-caption flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" aria-hidden="true" />
              Flagged vouchers can’t be bulk-approved. Open each one and record your reason.
            </p>
            {d.meta.last_page > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setParam({ page: page - 1 })}
                  className={cn(outlineBtn, 'h-8 px-3')}
                >
                  ‹ Prev
                </button>
                <span className="text-caption px-1.5">
                  Page {page} of {d.meta.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= d.meta.last_page}
                  onClick={() => setParam({ page: page + 1 })}
                  className={cn(outlineBtn, 'h-8 px-3')}
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <AnimatePresence>
        {bulk && (
          <ConfirmDialog
            key="bulk"
            width={480}
            tone="success"
            title={`Give final approval to ${plural(picked.length, 'voucher', 'vouchers')}?`}
            confirmLabel={`✓ Approve & release (${picked.length})`}
            busy={bulk.busy}
            error={bulk.error}
            onConfirm={approveSelected}
            onCancel={() => !bulk.busy && setBulk(null)}
          >
            <p className="text-body text-foreground">
              {formatMoney(picked.reduce((s, v) => s + Number(v.amount), 0).toFixed(2))} will be released for payment:{' '}
              {picked.map((v) => v.voucher_number).join(', ')}. This is the last approval step and can’t be undone.
            </p>
            <p className="text-caption">
              All or nothing: if one was already decided by someone else, none are approved and the list reloads.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Framer WAk4RKdFc: nothing waits for Level 2; today's decisions as three pills. */
function Cleared({ firstName, today }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-success-soft">
        <CheckCheck className="size-7 text-success" aria-hidden="true" />
      </div>
      <p className="text-card-title">All caught up{firstName ? `, ${firstName}` : ''}</p>
      <p className="text-body max-w-md text-muted-foreground">
        Every voucher that reached Level 2 has a final decision. New ones appear here as soon as Accounting approves them.
      </p>
      {today?.total > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          <Pill tone="success">{today.approved} approved today</Pill>
          <Pill tone="primary">{today.returned} returned</Pill>
          <Pill tone="danger">{today.rejected} rejected</Pill>
        </div>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the approval queue" className="flex flex-col gap-3.5">
      <div className="h-[420px] animate-pulse rounded-xl border bg-card" />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  PieChart,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { bulkApprove, getReviewOptions, listQueue } from '../api'
import { useOfficerSummary } from '../hooks/useOfficerSummary'
import { announceReviewsChanged, QUEUE_SORTS, QUEUE_VIEWS, REVIEWS_CHANGED_EVENT, reviewPath, waitedText } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const selectClass = 'text-body h-[38px] appearance-none rounded-lg border bg-card pr-8 pl-3 outline-none focus:border-primary'

/**
 * Review queue (/officer/queue; the landing page until the dashboard came, 2026-11-27; Framer vZeEe5_Hq list, Ssn7fclsz cleared).
 * Every voucher waiting for step 1 in the company you're working in, oldest first. Tabs, search, department,
 * amount and sort are in the address (?view=&q=&department=&amount=&sort=&page=). Bulk approve = select
 * mode (AI-flagged vouchers can't be picked). Reloads after a decision and every 60 s.
 * Code differs from the frame: the "Check" column is the rule-based automatic check (since 2026-11-27; "Not run"
 * for vouchers submitted before it existed); the cleared state links to "See what you reviewed" and "Check budgets" (Framer Ssn7fclsz).
 */
export default function ReviewQueuePage() {
  usePageTitle('Review queue')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const firstName = useAuthStore((s) => s.user?.first_name)
  const summary = useOfficerSummary()

  const view = params.get('view')
  const search = params.get('q') ?? ''
  const department = params.get('department') ?? ''
  const amount = params.get('amount') ?? ''
  const sort = params.get('sort') ?? 'oldest'
  const page = Number(params.get('page')) || 1

  const update = useCallback(
    (changes, { keepPage = false } = {}) =>
      setParams(
        (p) => {
          Object.entries(changes).forEach(([k, v]) => (v ? p.set(k, String(v)) : p.delete(k)))
          if (!keepPage) p.delete('page')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const [searchText, setSearchText] = useState(search)
  const debounced = useDebounce(searchText.trim(), 300)
  useEffect(() => {
    if (debounced !== search) update({ q: debounced })
  }, [debounced, search, update])

  // departments + the high-value amount, for the filters
  const [options, setOptions] = useState(null)
  useEffect(() => {
    let alive = true
    getReviewOptions()
      .then((o) => alive && setOptions(o))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [companyId])
  const amountRanges = useMemo(() => amountPresets(options?.high_value_threshold), [options])
  const range = amountRanges.find((r) => r.key === amount)

  const key = JSON.stringify([companyId, view, search, department, amount, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', vouchers: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    const id = ++requestRef.current
    const load = (quiet) =>
      listQueue({ view, search, department, amountMin: range?.min, amountMax: range?.max, sort, page })
        .then(({ vouchers, meta }) => id === requestRef.current && setState({ key, status: 'success', vouchers, meta, error: null }))
        .catch((error) => id === requestRef.current && !quiet && setState((p) => ({ ...p, key, status: 'error', error })))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(REVIEWS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.removeEventListener(REVIEWS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
    // range comes from `amount` (in the key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { vouchers, meta } = state
  const filtered = Boolean(view || search || department || amount)
  const waiting = summary.data?.queue
  const today = summary.data?.today

  // Bulk approve (select mode)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const pickable = vouchers.filter((v) => !v.ai.flagged)
  const chosen = vouchers.filter((v) => picked.has(v.id))
  const stopSelecting = () => {
    setSelecting(false)
    setPicked(new Set())
  }
  const toggle = (id) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState(null)
  const runBulk = async () => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const r = await bulkApprove(chosen.map((v) => v.id))
      toast.success(
        r.forwarded
          ? `${plural(r.approved + r.forwarded, 'voucher', 'vouchers')} approved · ${r.forwarded} went to the Supervisor for final approval.`
          : `${plural(r.approved, 'voucher', 'vouchers')} approved.`,
      )
      setConfirmBulk(false)
      stopSelecting()
    } catch (e) {
      setBulkError(e)
    } finally {
      setBulkBusy(false)
      announceReviewsChanged()
    }
  }

  const reviewNext = () => {
    const first = vouchers[0]
    if (first) navigate(reviewPath(first.id))
  }

  const cleared = status === 'success' && !filtered && (meta?.counts?.all ?? 0) === 0

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Review queue</h1>
          <p className="text-body text-muted-foreground">
            {waiting && waiting.total > 0
              ? `${plural(waiting.total, 'voucher', 'vouchers')} waiting for Level 1 review · ${formatMoney(waiting.total_amount)} total`
              : today?.last_reviewed_at
                ? `No vouchers waiting · last one reviewed ${formatTimeAgo(today.last_reviewed_at)}`
                : 'Vouchers your company’s clerks submit appear here for Level 1 review'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {selecting ? (
            <button type="button" onClick={stopSelecting} className={outlineBtn}>
              <X className="size-4" aria-hidden="true" /> Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              disabled={status !== 'success' || pickable.length === 0}
              className={outlineBtn}
            >
              <CheckCheck className="size-4" aria-hidden="true" /> Bulk approve
            </button>
          )}
          {cleared ? (
            <Link to={PATHS.OFFICER} className={primaryBtn}>
              <LayoutDashboard className="size-4" aria-hidden="true" /> Back to dashboard
            </Link>
          ) : (
            <button type="button" onClick={reviewNext} disabled={status !== 'success' || vouchers.length === 0} className={primaryBtn}>
              Review next <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Views" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-card p-1">
        {QUEUE_VIEWS.map((v) => {
          const active = (view ?? null) === v.key
          const n = meta?.counts?.[v.count]
          return (
            <button
              key={v.count}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ view: v.key })}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'text-auth-button bg-primary text-primary-foreground' : 'text-body-strong hover:bg-muted',
                !active && v.tone === 'danger' && 'text-danger',
              )}
            >
              {v.tone === 'danger' && <TriangleAlert className="size-3.5" aria-hidden="true" />}
              {v.label}
              {n !== undefined && <span className={cn('text-caption', active && 'text-primary-foreground/80')}>{n}</span>}
            </button>
          )
        })}
      </div>

      {selecting && (
        <div
          className="flex flex-wrap items-center gap-2.5 rounded-[10px] border bg-card px-4 py-2.5"
          role="region"
          aria-label="Bulk approve"
        >
          <p className="text-body-strong">
            {chosen.length ? `${chosen.length} selected · ${formatMoney(sumAmounts(chosen))}` : 'Tick the vouchers to approve'}
          </p>
          <span className="text-caption">Flagged vouchers need their own review and can’t be picked.</span>
          <button
            type="button"
            onClick={() => setPicked(chosen.length === pickable.length ? new Set() : new Set(pickable.map((v) => v.id)))}
            className="text-auth-link text-primary hover:underline"
          >
            {chosen.length === pickable.length ? 'Clear' : `Select all ${pickable.length}`}
          </button>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => {
              setBulkError(null)
              setConfirmBulk(true)
            }}
            className="text-auth-button ml-auto flex h-[34px] items-center gap-1.5 rounded-lg bg-success px-3.5 text-white outline-none hover:bg-success/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="size-4" aria-hidden="true" /> Approve {chosen.length || ''}
          </button>
        </div>
      )}

      {cleared ? (
        <QueueCleared firstName={firstName} today={today} />
      ) : (
        <section className="flex flex-col overflow-hidden rounded-xl border bg-card" aria-label="Vouchers waiting">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="flex h-[38px] min-w-[220px] flex-1 items-center gap-2 rounded-lg border bg-muted px-3 focus-within:border-primary">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search voucher no., payee, clerk…"
                aria-label="Search the queue"
                maxLength={100}
                className="text-body w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <Picker label="Department" value={department} onChange={(v) => update({ department: v })}>
              <option value="">All departments</option>
              {(options?.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="none">No department</option>
            </Picker>
            <Picker label="Amount" value={amount} onChange={(v) => update({ amount: v })}>
              {amountRanges.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Picker>
            <Picker label="Sort" value={sort} onChange={(v) => update({ sort: v === 'oldest' ? null : v })}>
              {QUEUE_SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </Picker>
          </div>

          {status === 'loading' && (
            <div role="status" aria-label="Loading the queue" className="flex flex-col border-t">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="h-4 w-56 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-8 w-16 animate-pulse rounded-lg bg-muted" />
                </div>
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="border-t">
              <ErrorState
                title="Couldn't load the queue"
                message={state.error.message}
                requestId={state.error.requestId}
                onRetry={() => setAttempt((n) => n + 1)}
              />
            </div>
          )}

          {status === 'success' && vouchers.length === 0 && (
            <div className="flex flex-col items-center gap-3 border-t px-6 py-12 text-center">
              <SearchX className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-card-title">No vouchers match</p>
              <p className="text-body text-muted-foreground">
                {search ? `Nothing found for “${search}”.` : 'Nothing waiting with these filters.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchText('')
                  update({ view: null, q: null, department: null, amount: null })
                }}
                className={outlineBtn}
              >
                Show the whole queue
              </button>
            </div>
          )}

          {status === 'success' && vouchers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-y bg-muted">
                  <tr className="text-table-head text-muted-foreground">
                    {selecting && (
                      <th className="w-10 py-2 pl-4">
                        <span className="sr-only">Select</span>
                      </th>
                    )}
                    <th className="px-4 py-2 font-semibold">Voucher · payee</th>
                    <th className="w-[150px] px-3 py-2 font-semibold">Clerk · dept</th>
                    <th className="w-[130px] px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="w-[110px] px-3 py-2 font-semibold">Check</th>
                    <th className="w-[80px] px-3 py-2 font-semibold">Waiting</th>
                    <th className="w-[96px] px-4 py-2 font-semibold">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <QueueRow key={v.id} v={v} selecting={selecting} picked={picked.has(v.id)} onToggle={toggle} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {status === 'success' && meta?.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t px-4 py-3">
              <p className="text-caption">
                Showing {meta.from}–{meta.to} of {meta.total} · {formatMoney(meta.total_amount)} · SLA: review within {meta.sla_hours} h
              </p>
              {meta.last_page > 1 && (
                <nav aria-label="Pages" className="text-caption flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => update({ page: page - 1 > 1 ? page - 1 : null }, { keepPage: true })}
                    className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
                  >
                    ‹
                  </button>
                  <span aria-current="page">
                    Page {meta.current_page} of {meta.last_page}
                  </span>
                  <button
                    type="button"
                    disabled={page >= meta.last_page}
                    onClick={() => update({ page: page + 1 }, { keepPage: true })}
                    className="text-auth-link text-primary hover:underline disabled:opacity-50"
                  >
                    Next page →
                  </button>
                </nav>
              )}
            </div>
          )}
        </section>
      )}

      <AnimatePresence>
        {confirmBulk && (
          <ConfirmDialog
            width={460}
            icon={{ icon: CheckCheck, tone: 'success' }}
            title={`Approve ${plural(chosen.length, 'voucher', 'vouchers')}?`}
            description={`${formatMoney(sumAmounts(chosen))} in all`}
            confirmLabel={`Approve ${chosen.length}`}
            busy={bulkBusy}
            error={bulkError}
            onConfirm={runBulk}
            onCancel={() => !bulkBusy && setConfirmBulk(false)}
          >
            <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted px-3 py-2">
              {chosen.map((v) => (
                <li key={v.id} className="text-caption flex justify-between gap-3">
                  <span className="truncate">
                    {v.voucher_number} · {v.payee_name}
                    {v.needs_supervisor && <span className="text-warning"> · goes to Supervisor</span>}
                  </span>
                  <span className="tabular-nums">{formatMoney(v.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-caption mt-2">
              Each is approved at Level 1 with no remarks and goes on to the Supervisor for the final approval. All or nothing.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  )
}

function QueueRow({ v, selecting, picked, onToggle }) {
  const navigate = useNavigate()
  const open = () => (selecting ? !v.ai.flagged && onToggle(v.id) : navigate(reviewPath(v.id)))
  const hint = [
    v.category,
    v.ai.flagged ? (v.ai.reason ?? 'Flagged') : null,
    !v.ai.flagged && v.high_value ? 'needs Supervisor' : null,
    v.resubmitted ? 'resubmitted after return' : null,
  ].filter(Boolean)

  return (
    <tr
      onClick={open}
      className={cn(
        'cursor-pointer border-b last:border-b-0',
        v.ai.flagged ? 'bg-danger-soft hover:bg-danger-soft/70' : 'hover:bg-primary-faint',
        selecting && picked && 'bg-primary-faint',
      )}
    >
      {selecting && (
        <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={picked}
            disabled={v.ai.flagged}
            onChange={() => onToggle(v.id)}
            aria-label={`Select ${v.voucher_number}`}
            title={v.ai.flagged ? 'Flagged: review it on its own' : undefined}
            className="size-4 accent-primary disabled:opacity-40"
          />
        </td>
      )}
      <td className="px-4 py-2.5">
        <p className="text-body-strong">
          {v.voucher_number} · {v.payee_name ?? 'No payee'}
        </p>
        <p className="text-caption truncate">{hint.join(' · ')}</p>
      </td>
      <td className="px-3 py-2.5">
        <p className="text-body truncate" title={v.clerk.name ?? undefined}>
          {v.clerk.short ?? '—'}
        </p>
        <p className="text-caption truncate">{v.department ?? 'No department'}</p>
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
          <span className="text-caption" title="Submitted before the automatic check existed, or it’s still running">
            Not run
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span
          title={v.submitted_at ? `Submitted ${formatDate(v.submitted_at, 'MMM d, h:mm a')}` : undefined}
          className={cn(
            'text-caption whitespace-nowrap',
            v.sla === 'near' && 'text-badge text-warning',
            v.sla === 'over' && 'text-badge text-danger',
          )}
        >
          {waitedText(v.submitted_at)}
          {v.sla !== 'ok' && ' ⏱'}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {!selecting && (
          <Link
            to={reviewPath(v.id)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex h-8 w-[72px] items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              v.ai.flagged
                ? 'text-auth-button bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-body-strong border bg-card hover:bg-muted',
            )}
          >
            {v.ai.flagged ? 'Review' : 'Open'}
          </Link>
        )}
      </td>
    </tr>
  )
}

/** Framer Ssn7fclsz: nothing waiting; today's decisions as 3 numbers. */
function QueueCleared({ firstName, today }) {
  const reviewed = today?.total ?? 0
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-success bg-success-soft">
        <Check className="size-7 text-success" aria-hidden="true" />
      </div>
      <p className="text-card-title">
        {reviewed > 0 ? `Queue cleared — nice work${firstName ? `, ${firstName}` : ''}!` : 'Nothing waiting for review'}
      </p>
      <p className="text-body max-w-md text-muted-foreground">
        {reviewed > 0 ? `You reviewed ${plural(reviewed, 'voucher', 'vouchers')} today. ` : ''}New submissions will appear here
        automatically.
      </p>
      {reviewed > 0 && (
        <div className="flex overflow-hidden rounded-[10px] border bg-muted">
          {[
            ['Approved', today.approved],
            ['Returned', today.returned],
            ['Rejected', today.rejected],
          ].map(([label, n]) => (
            <div key={label} className="flex w-[120px] flex-col items-center gap-0.5 border-l p-3 first:border-l-0">
              <span className="text-card-title tabular-nums">{n}</span>
              <span className="text-caption">{label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap justify-center gap-2.5">
        <Link to={PATHS.OFFICER_REVIEWED} className={outlineBtn}>
          <ListChecks className="size-4" aria-hidden="true" /> See what you reviewed
        </Link>
        <Link to={PATHS.OFFICER_BUDGETS} className={outlineBtn}>
          <PieChart className="size-4" aria-hidden="true" /> Check budgets
        </Link>
      </div>
    </div>
  )
}

function Picker({ label, value, onChange, children }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  )
}

/** Amount filter choices; the last one follows the high-value threshold from Global settings. */
function amountPresets(threshold) {
  const t = threshold ? Number(threshold) : 50000
  return [
    { key: '', label: 'Any amount' },
    { key: 'under10k', label: 'Under ₱10,000', max: '9999.99' },
    { key: 'mid', label: `₱10,000 – ${formatMoney(String(t - 0.01))}`, min: '10000', max: (t - 0.01).toFixed(2) },
    { key: 'high', label: `${formatMoney(String(t))} and up`, min: t.toFixed(2) },
  ]
}

/** Total of several DECIMAL strings, in centavos (no float drift). */
function sumAmounts(list) {
  const cents = list.reduce((sum, v) => sum + Math.round(Number(v.amount) * 100), 0)
  return (cents / 100).toFixed(2)
}

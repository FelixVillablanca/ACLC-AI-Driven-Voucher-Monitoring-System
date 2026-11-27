import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Info, ListChecks } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listLevel2Flagged } from '../api'
import { DECISIONS_CHANGED_EVENT, daysWaiting, level2FlagPath, primaryBtn, shortName } from '../utils'

const SORTS = [
  { key: 'score', label: 'Highest score' },
  { key: 'oldest', label: 'Waiting longest' },
  { key: 'amount_desc', label: 'Amount: high to low' },
]

/**
 * FLAGGED VOUCHERS at Level 2 (/supervisor/flagged; Framer ESBUdF0jl), 2026-11-27. Flagged vouchers that passed
 * Accounting and wait for the Supervisor, highest score first, plus 3 real numbers: open flags (+ money on hold),
 * the flagged vouchers YOU decided this month, and how flags of the last 90 days ended.
 * Code differs from the frame: "Flagged" by the automatic check (rules), not "AI-flagged" / Isolation Forest; the
 * risk pill comes from the check's own signals (any "high" signal = High risk); the footer doesn't promise retraining
 * (no model exists yet).
 */
export default function Level2FlaggedPage() {
  usePageTitle('Flagged vouchers')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const page = Number(params.get('page')) || 1
  const sort = SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'score'
  const key = JSON.stringify([companyId, page, sort])
  const [state, setState] = useState({ key: null, status: 'loading', vouchers: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      listLevel2Flagged({ sort, page, background: quiet })
        .then(({ vouchers, meta }) => alive && setState({ key, status: 'success', vouchers, meta, error: null }))
        .catch((error) => alive && !quiet && setState({ key, status: 'error', vouchers: [], meta: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(DECISIONS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      alive = false
      window.removeEventListener(DECISIONS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
  }, [key, sort, page, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { vouchers, meta } = state
  const stats = meta?.stats
  const decided = stats ? stats.decided.approved + stats.decided.rejected + stats.decided.returned : 0
  const setQuery = (next) => {
    const merged = { sort, page: String(page), ...next }
    const clean = {}
    if (merged.sort && merged.sort !== 'score') clean.sort = merged.sort
    if (merged.page && merged.page !== '1') clean.page = merged.page
    setParams(clean)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Flagged vouchers</h1>
          <p className="text-body text-muted-foreground">
            Flagged by the automatic check
            {stats ? (stats.needs_step2 ? ' · Level 2 review is required for every flag' : ' · sent to you by Accounting') : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="l2-flag-sort">
            Sort
          </label>
          <select
            id="l2-flag-sort"
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value, page: '1' })}
            className={cn(inputClass, 'h-[38px] w-auto pr-8')}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                ⚑ {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!vouchers.length || status !== 'success'}
            onClick={() => navigate(level2FlagPath(vouchers[0].id))}
            className={primaryBtn}
          >
            Investigate top flag <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Stat
          label="Open flags"
          value={stats ? stats.open : '—'}
          caption={stats ? (stats.open ? `${formatMoney(stats.on_hold)} on hold` : 'Nothing on hold') : ' '}
          tone={stats?.open ? 'danger' : undefined}
        />
        <Stat
          label="Decided by you this month"
          value={stats ? decided : '—'}
          caption={
            stats
              ? decided
                ? [
                    stats.decided.approved && `${stats.decided.approved} approved`,
                    stats.decided.rejected && `${stats.decided.rejected} rejected`,
                    stats.decided.returned && `${stats.decided.returned} returned`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'No flagged voucher decided yet'
              : ' '
          }
        />
        <Stat
          label="How flags ended (90 days)"
          value={stats ? (stats.accuracy.pct === null ? '—' : `${stats.accuracy.pct}%`) : '—'}
          caption={
            stats
              ? stats.accuracy.ended
                ? `of ${plural(stats.accuracy.ended, 'finished flag', 'finished flags')} ended in rejection`
                : 'No flagged voucher has been finished yet'
              : ' '
          }
        />
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading flagged vouchers" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border bg-card px-[18px] py-4">
              <div className="size-16 animate-pulse rounded-xl bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-72 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-56 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-[34px] w-[110px] animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load flagged vouchers"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && vouchers.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-success bg-success-soft">
            <Check className="size-7 text-success" aria-hidden="true" />
          </div>
          <p className="text-card-title">No flagged vouchers waiting for you</p>
          <p className="text-body max-w-md text-muted-foreground">
            When Accounting approves a flagged voucher, it appears here for your final decision.
          </p>
          <Link
            to={PATHS.SUPERVISOR_QUEUE}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 hover:bg-muted"
          >
            <ListChecks className="size-4" aria-hidden="true" /> Back to the approval queue
          </Link>
        </div>
      )}

      {status === 'success' && vouchers.length > 0 && (
        <ul className="flex flex-col gap-3">
          {vouchers.map((v, i) => {
            const high = v.tags.some((t) => t.impact === 'high')
            return (
              <li
                key={v.id}
                className={cn(
                  'flex flex-wrap items-center gap-4 rounded-xl border bg-card px-[18px] py-4',
                  i === 0 && page === 1 && sort === 'score' && 'border-[1.5px] border-danger',
                )}
              >
                <div
                  className={cn(
                    'flex size-16 shrink-0 flex-col items-center justify-center rounded-xl border-2',
                    high ? 'border-danger bg-danger-soft' : 'border-warning bg-warning-soft',
                  )}
                >
                  <span className={cn('text-card-title tabular-nums', high ? 'text-danger' : 'text-warning')}>
                    {v.ai.score ? Number(v.ai.score).toFixed(2) : '—'}
                  </span>
                  <span className="text-caption">score</span>
                </div>
                <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                  <p className="text-body-strong">
                    {v.voucher_number} · {v.summary ?? v.payee_name ?? 'No description'} · {formatMoney(v.amount)}
                  </p>
                  <p className="text-body">{v.ai.reason ?? 'The automatic check found this voucher unusual for this company.'}</p>
                  <p className="text-caption">
                    {[
                      v.department ?? 'No department',
                      v.level1 ? `Level 1 ✓ ${shortName(v.level1.by)}` : null,
                      v.level1 ? `waiting ${daysWaiting(v.level1.at).toLowerCase()}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={high ? 'danger' : 'warning'}>{high ? 'High risk' : 'Medium risk'}</Pill>
                  <Link
                    to={level2FlagPath(v.id)}
                    className="text-auth-button flex h-[34px] items-center justify-center rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Investigate
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {status === 'success' && meta?.last_page > 1 && (
        <nav aria-label="Pages" className="text-caption flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setQuery({ page: String(page - 1) })}
            className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
            aria-label="Previous page"
          >
            ‹
          </button>
          Page {meta.current_page} of {meta.last_page}
          <button
            type="button"
            disabled={page >= meta.last_page}
            onClick={() => setQuery({ page: String(page + 1) })}
            className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
            aria-label="Next page"
          >
            ›
          </button>
        </nav>
      )}

      <p className="text-caption flex items-start gap-2 rounded-xl border bg-primary-faint px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          A flag is a signal, not a verdict. Your decision and remarks are saved in the voucher&apos;s approval trail.
          {meta?.threshold ? ` A voucher is flagged when its score reaches ${Number(meta.threshold).toFixed(2)}.` : ''}
        </span>
      </p>
    </div>
  )
}

function Stat({ label, value, caption, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-[18px] py-4">
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'danger' && 'text-danger')}>{value}</span>
      <span className="text-caption">{caption}</span>
    </div>
  )
}

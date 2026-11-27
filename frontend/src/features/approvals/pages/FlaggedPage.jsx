import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Info, ListChecks } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listFlagged } from '../api'
import HowFlagsWorkDialog from '../components/HowFlagsWorkDialog'
import MarkNormalDialog from '../components/MarkNormalDialog'
import { announceReviewsChanged, flaggedPath, REVIEWS_CHANGED_EVENT, scoreLevel, waitedText } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const LEVEL = {
  high: { box: 'border-danger bg-danger-soft', text: 'text-danger' },
  medium: { box: 'border-danger bg-danger-soft', text: 'text-danger' },
  low: { box: 'border-warning bg-warning-soft', text: 'text-warning' },
}

/**
 * Flagged vouchers (/officer/flagged; Framer dtNDyUAUp): vouchers still waiting for Accounting that the
 * automatic check flagged and nobody has looked into yet, highest score first, with this month's stats.
 * Investigate → (YX1IiDXMp) or Mark as normal (clears the flag). ?page= in the address.
 * Code differs from the frame: titled "Flagged" (the check is rule-based until the AI model arrives, user
 * decision 2026-11-27); "Confirmed issues · ₱… held back" counts returned-as-needs-changes or rejected flags.
 */
export default function FlaggedPage() {
  usePageTitle('Flagged vouchers')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const page = Number(params.get('page')) || 1
  const key = JSON.stringify([companyId, page])
  const [state, setState] = useState({ key: null, status: 'loading', vouchers: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      listFlagged({ page })
        .then(({ vouchers, meta }) => alive && setState({ key, status: 'success', vouchers, meta, error: null }))
        .catch((error) => alive && !quiet && setState({ key, status: 'error', vouchers: [], meta: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(REVIEWS_CHANGED_EVENT, refresh)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      alive = false
      window.removeEventListener(REVIEWS_CHANGED_EVENT, refresh)
      window.clearInterval(timer)
    }
  }, [key, page, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { vouchers, meta } = state
  const stats = meta?.stats
  const [howOpen, setHowOpen] = useState(false)
  const [normalFor, setNormalFor] = useState(null)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Flagged vouchers</h1>
          <p className="text-body text-muted-foreground">
            {stats?.waiting
              ? `${plural(stats.waiting, 'voucher', 'vouchers')} the automatic check wants you to look at closely`
              : 'Vouchers the automatic check wants you to look at closely'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Info className="size-4" aria-hidden="true" /> How flags work
          </button>
          <button
            type="button"
            disabled={!vouchers.length}
            onClick={() => navigate(flaggedPath(vouchers[0].id))}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Investigate first <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <Stat label="Flagged this month" value={stats ? plural(stats.flagged_this_month, 'voucher', 'vouchers') : '—'} />
        <Stat
          label="Confirmed issues"
          value={stats ? `${stats.confirmed}${stats.confirmed ? ` · ${formatMoney(stats.confirmed_amount)} held back` : ''}` : '—'}
        />
        <Stat label="Cleared as normal" value={stats ? stats.cleared : '—'} />
        <Stat label="Flag threshold" value={stats ? `Score ≥ ${Number(stats.threshold).toFixed(2)}` : '—'} />
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading flagged vouchers" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border bg-card px-[18px] py-4">
              <div className="size-16 animate-pulse rounded-xl bg-muted" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-72 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-[34px] w-[132px] animate-pulse rounded-lg bg-muted" />
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
          <p className="text-card-title">No flagged vouchers waiting</p>
          <p className="text-body max-w-md text-muted-foreground">
            Every flag has been looked into. New ones appear here right after a clerk submits.
          </p>
          <Link
            to={PATHS.OFFICER_QUEUE}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 hover:bg-muted"
          >
            <ListChecks className="size-4" aria-hidden="true" /> Back to the review queue
          </Link>
        </div>
      )}

      {status === 'success' &&
        vouchers.map((v, i) => {
          const level = scoreLevel(v.score)
          return (
            <article
              key={v.id}
              className={cn(
                'flex flex-wrap items-center gap-4 rounded-xl border bg-card px-[18px] py-4',
                i === 0 && 'border-[1.5px] border-danger',
              )}
            >
              <div className={cn('flex size-16 shrink-0 flex-col items-center justify-center rounded-xl border-2', LEVEL[level].box)}>
                <span className={cn('text-body-strong tabular-nums', LEVEL[level].text)}>{Number(v.score).toFixed(2)}</span>
                <span className="text-caption">{level}</span>
              </div>
              <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                <p className="text-body-strong">
                  {v.voucher_number} · {v.payee_name ?? 'No payee'} · {formatMoney(v.amount)}
                </p>
                <p className="text-body">{v.reason}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {v.tags.map((t) => (
                    <Pill key={t.label} tone={t.impact === 'high' ? 'danger' : 'warning'}>
                      {t.label}
                    </Pill>
                  ))}
                  <span className="text-caption">
                    {[v.clerk, v.submitted_at && `${waitedText(v.submitted_at)} ago`].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-row gap-1.5 sm:w-[132px] sm:flex-col">
                <Link
                  to={flaggedPath(v.id)}
                  className="text-auth-button flex h-[34px] flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Investigate →
                </Link>
                <button
                  type="button"
                  onClick={() => setNormalFor(v)}
                  className="text-body-strong flex h-[34px] flex-1 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Mark as normal
                </button>
              </div>
            </article>
          )
        })}

      {status === 'success' && meta?.last_page > 1 && (
        <nav aria-label="Pages" className="text-caption flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setParams(page - 1 > 1 ? { page: String(page - 1) } : {})}
            className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
          >
            ‹
          </button>
          Page {meta.current_page} of {meta.last_page}
          <button
            type="button"
            disabled={page >= meta.last_page}
            onClick={() => setParams({ page: String(page + 1) })}
            className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
          >
            ›
          </button>
        </nav>
      )}

      <AnimatePresence>
        {howOpen && <HowFlagsWorkDialog key="how" stats={stats} onClose={() => setHowOpen(false)} />}
        {normalFor && (
          <MarkNormalDialog
            key="normal"
            voucher={normalFor}
            onCancel={() => setNormalFor(null)}
            onConflict={(e) => {
              toast.error(e.message, { duration: 7000 })
              setNormalFor(null)
              announceReviewsChanged()
            }}
            onDone={(r) => {
              toast.success(`${r.voucher_number} was marked as normal. It stays in the review queue.`)
              setNormalFor(null)
              announceReviewsChanged()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-l px-[18px] py-3.5 first:border-l-0 lg:border-b-0 [&:nth-child(3)]:border-l-0 lg:[&:nth-child(3)]:border-l">
      <span className="text-caption">{label}</span>
      <span className="text-card-title">{value}</span>
    </div>
  )
}

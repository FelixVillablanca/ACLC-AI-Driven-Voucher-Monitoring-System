import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ListChecks, Undo2, X } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { statusPill } from '@/features/vouchers'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listMyReviews } from '../api'
import { REVIEWS_CHANGED_EVENT, reviewPath } from '../utils'

const TABS = [
  { key: null, label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'returned', label: 'Returned' },
  { key: 'rejected', label: 'Rejected' },
]

const LOOK = {
  approved: { icon: Check, tone: 'text-success', text: 'Approved' },
  returned: { icon: Undo2, tone: 'text-warning', text: 'Returned' },
  rejected: { icon: X, tone: 'text-danger', text: 'Rejected' },
}

/**
 * Reviewed by me (/officer/reviewed; code-first, no frame, 2026-11-26): every Level 1 decision you made in
 * the company you're working in, newest first, with today's numbers. Each row opens the voucher and shows
 * where it is now (e.g. approved by you, now "With Supervisor"). ?action=&page= in the address.
 */
export default function ReviewedByMePage() {
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const action = params.get('action')
  const page = Number(params.get('page')) || 1
  const key = JSON.stringify([companyId, action, page])
  const [state, setState] = useState({ key: null, status: 'loading', reviews: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      listMyReviews({ action, page })
        .then(({ reviews, meta }) => alive && setState({ key, status: 'success', reviews, meta, error: null }))
        .catch((error) => alive && !quiet && setState({ key, status: 'error', reviews: [], meta: null, error }))
    load(false)
    const refresh = () => load(true)
    window.addEventListener(REVIEWS_CHANGED_EVENT, refresh)
    return () => {
      alive = false
      window.removeEventListener(REVIEWS_CHANGED_EVENT, refresh)
    }
  }, [key, action, page, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { reviews, meta } = state
  const today = meta?.today
  const go = (changes) => {
    const next = { action, page: String(page), ...changes }
    const clean = {}
    if (next.action) clean.action = next.action
    if (Number(next.page) > 1) clean.page = next.page
    setParams(clean, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">Reviewed by me</h1>
        <p className="text-body text-muted-foreground">
          Your Level 1 decisions in this company{today?.last_reviewed_at ? ` · last one ${formatTimeAgo(today.last_reviewed_at)}` : ''}
        </p>
      </div>

      {today && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Today', today.total, 'text-foreground'],
            ['Approved today', today.approved, 'text-success'],
            ['Returned today', today.returned, 'text-warning'],
            ['Rejected today', today.rejected, 'text-danger'],
          ].map(([label, n, tone]) => (
            <div key={label} className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
              <span className="text-caption">{label}</span>
              <span className={cn('text-stat-value tabular-nums', tone)}>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div role="tablist" aria-label="Decision" className="flex w-fit gap-1 rounded-xl border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={action === t.key}
            onClick={() => go({ action: t.key, page: '1' })}
            className={cn(
              'h-9 rounded-lg px-3',
              action === t.key ? 'text-auth-button bg-primary text-primary-foreground' : 'text-body-strong hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card" aria-label="Your decisions">
        {status === 'loading' && (
          <div role="status" aria-label="Loading" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0">
                <div className="size-5 animate-pulse rounded-full bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load your reviews"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {status === 'success' && reviews.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ListChecks className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-card-title">{action ? `Nothing ${action} yet` : 'You haven’t reviewed anything yet'}</p>
            <Link to={PATHS.OFFICER_QUEUE} className="text-auth-link text-primary hover:underline">
              Go to the review queue →
            </Link>
          </div>
        )}
        {status === 'success' && reviews.length > 0 && (
          <ul>
            {reviews.map((r) => {
              const look = LOOK[r.action] ?? LOOK.approved
              const now = statusPill(r.voucher.status)
              return (
                <li key={r.id} className="border-b last:border-b-0">
                  <Link to={reviewPath(r.voucher.id)} className="flex items-start gap-3 px-4 py-3 hover:bg-primary-faint">
                    <look.icon className={cn('mt-0.5 size-4 shrink-0', look.tone)} aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-body-strong">
                        {look.text} {r.voucher.voucher_number} · {r.voucher.payee_name ?? 'No payee'}
                      </p>
                      <p className="text-caption">
                        {[r.voucher.clerk, formatDate(r.at, 'MMM d, h:mm a'), r.reason].filter(Boolean).join(' · ')}
                        {r.needs_changes.length > 0 && ` · needs: ${r.needs_changes.join(', ')}`}
                      </p>
                      {r.remarks && <p className="text-body truncate text-muted-foreground">“{r.remarks}”</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-body-strong tabular-nums">{formatMoney(r.voucher.amount)}</span>
                      <Pill tone={now.tone}>Now: {now.text}</Pill>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {status === 'success' && meta?.last_page > 1 && (
          <nav aria-label="Pages" className="text-caption flex items-center justify-between gap-2 border-t px-4 py-3">
            <span>
              Showing {meta.from}–{meta.to} of {meta.total}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => go({ page: String(page - 1) })}
                className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
              >
                ‹
              </button>
              Page {meta.current_page} of {meta.last_page}
              <button
                type="button"
                disabled={page >= meta.last_page}
                onClick={() => go({ page: String(page + 1) })}
                className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
              >
                ›
              </button>
            </span>
          </nav>
        )}
      </section>
    </div>
  )
}

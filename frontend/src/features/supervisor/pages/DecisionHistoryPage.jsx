import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { History } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listMyDecisions } from '../api'
import { DECISIONS_CHANGED_EVENT, level2Path } from '../utils'

const ACTIONS = [
  { key: null, label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'returned', label: 'Returned' },
  { key: 'rejected', label: 'Rejected' },
]
const PILL = { approved: ['success', 'Approved'], returned: ['warning', 'Returned'], rejected: ['danger', 'Rejected'] }

/**
 * DECISION HISTORY (/supervisor/history; code-first, 2026-11-27: the frames link to it, no frame of its own).
 * Every Level 2 decision you made in this company, newest first, with your remarks; returns say who got the voucher
 * back. ?action=&page= in the address.
 */
export default function DecisionHistoryPage() {
  usePageTitle('Decision history')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const action = params.get('action')
  const page = Number(params.get('page')) || 1
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${companyId}|${action}|${page}|${attempt}`

  useEffect(() => {
    let alive = true
    const load = () =>
      listMyDecisions({ action, page })
        .then((data) => alive && setState({ key, status: 'success', data, error: null }))
        .catch((error) => alive && setState({ key, status: 'error', data: null, error }))
    load()
    window.addEventListener(DECISIONS_CHANGED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(DECISIONS_CHANGED_EVENT, load)
    }
  }, [key, action, page])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const today = d?.meta.today
  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, String(v))))
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">Decision history</h1>
        <p className="text-body text-muted-foreground">
          Your Level 2 decisions in this company
          {today?.total ? ` · today: ${today.approved} approved, ${today.returned} returned, ${today.rejected} rejected` : ''}
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-3" role="tablist" aria-label="Decision filter">
          {ACTIONS.map((a) => {
            const on = (action ?? null) === a.key
            return (
              <button
                key={a.label}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setParam({ action: a.key, page: null })}
                className={cn(
                  'text-body-strong h-8 rounded-lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  on ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {a.label}
              </button>
            )
          })}
        </div>

        {status === 'loading' && <div role="status" aria-label="Loading decisions" className="h-[320px] animate-pulse bg-muted/40" />}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load your decisions"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {d && d.reviews.length === 0 && (
          <EmptyState
            icon={History}
            title={action ? 'No decisions of this kind yet' : 'No decisions yet'}
            description="Vouchers you approve, return or reject at Level 2 are listed here."
            action={
              <Link to={PATHS.SUPERVISOR_QUEUE} className="text-auth-link text-primary hover:underline">
                Open the approval queue →
              </Link>
            }
          />
        )}
        {d && d.reviews.length > 0 && (
          <ul>
            {d.reviews.map((r) => {
              const [tone, label] = PILL[r.action] ?? ['neutral', r.action]
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-3 border-b px-4 py-3 last:border-b-0">
                  <Pill tone={tone}>{label}</Pill>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-body">
                      <Link to={level2Path(r.voucher.id)} className="text-body-strong text-primary hover:underline">
                        {r.voucher.voucher_number}
                      </Link>{' '}
                      · {r.voucher.payee_name ?? 'No payee'} · {formatMoney(r.voucher.amount)}
                      {r.clerk ? ` · by ${r.clerk}` : ''}
                    </p>
                    <p className="text-caption">
                      {formatDate(r.at, 'MMM d, yyyy · h:mm a')}
                      {r.step === 1 ? ' · Level 1' : ''}
                      {r.sent_to ? ` · sent back to ${r.sent_to === 'accounting' ? 'Accounting' : 'the clerk'}` : ''}
                      {r.needs_changes.length ? ` · ${r.needs_changes.join(', ')}` : ''}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </p>
                    {r.remarks && <p className="text-caption italic">“{r.remarks}”</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {d && d.meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
            <p className="text-caption">
              {d.meta.from}–{d.meta.to} of {d.meta.total}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam({ page: page - 1 })}
                className="text-body-strong h-8 rounded-lg border bg-card px-3 disabled:opacity-50"
              >
                ‹ Prev
              </button>
              <button
                type="button"
                disabled={page >= d.meta.last_page}
                onClick={() => setParam({ page: page + 1 })}
                className="text-body-strong h-8 rounded-lg border bg-card px-3 disabled:opacity-50"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

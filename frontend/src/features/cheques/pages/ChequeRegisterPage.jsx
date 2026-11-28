import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { NotebookTabs, Search, X } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { normalizeApiError } from '@/lib/apiError'
import { PATHS, ROLES } from '@/lib/constants'
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listCheques } from '../api'
import ChequeDialog from '../components/ChequeDialog'
import ChequeStatusPill from '../components/ChequeStatusPill'
import { staleHint } from '../utils'

const VIEWS = [
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'issued', label: 'Issued' },
  { key: 'released', label: 'Released' },
  { key: 'cleared', label: 'Cleared' },
  { key: 'stale', label: 'Stale' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

const SORTS = [
  { key: 'recent', label: 'Newest cheque date' },
  { key: 'oldest', label: 'Oldest cheque date' },
  { key: 'stale_soon', label: 'Closest to going stale' },
  { key: 'amount_high', label: 'Largest amount' },
]

const small =
  'text-caption h-8 rounded-lg border bg-card px-2.5 font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Cheque register (code-first, 2026-11-29): /clerk/cheques, /officer/cheques, /supervisor/cheques.
 * Clerks: the cheques of their own vouchers, with Release / Mark cleared / Cancel on each row and a link to the
 * voucher. Officers and Supervisors: the whole company, read-only. ?view=&q=&sort=&page= in the address.
 */
export default function ChequeRegisterPage() {
  usePageTitle('Cheques')
  const role = useAuthStore((s) => s.user?.role)
  const isClerk = role === ROLES.CLERK
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [params, setParams] = useSearchParams()
  const view = params.get('view') || 'outstanding'
  const sort = params.get('sort') || 'recent'
  const page = Number(params.get('page')) || 1
  const [text, setText] = useState(params.get('q') ?? '')
  const search = useDebounce(text.trim(), 300)
  const [state, setState] = useState({ key: null, status: 'loading', rows: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [dialog, setDialog] = useState(null) // { mode, cheque }
  const key = JSON.stringify([companyId, view, sort, page, search, attempt])

  const go = (changes) => {
    const next = { view, sort, page: String(page), q: search, ...changes }
    const clean = {}
    if (next.view && next.view !== 'outstanding') clean.view = next.view
    if (next.sort && next.sort !== 'recent') clean.sort = next.sort
    if (next.q) clean.q = next.q
    if (Number(next.page) > 1) clean.page = next.page
    setParams(clean, { replace: true })
  }

  // a new search goes back to page 1 and is kept in the address
  useEffect(() => {
    if ((params.get('q') ?? '') !== search) go({ q: search, page: '1' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    listCheques({ view, sort, page, search: search || undefined }, { signal: controller.signal })
      .then(({ data, meta }) => setState({ key, status: 'success', rows: data, meta, error: null }))
      .catch((err) => !controller.signal.aborted && setState({ key, status: 'error', rows: [], meta: null, error: normalizeApiError(err) }))
    return () => controller.abort()
  }, [key, view, sort, page, search])

  const status = state.key === key ? state.status : 'loading'
  const { rows, meta } = state
  const counts = meta?.counts

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">Cheques</h1>
        <p className="text-body text-muted-foreground">
          {isClerk
            ? 'The cheques written for your approved vouchers in this company. A cheque goes stale 180 days after its date.'
            : 'Every cheque written for this company’s approved vouchers. Clerks record them; this view is read-only.'}
        </p>
      </div>

      {meta && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card
            label="Outstanding"
            value={formatMoney(meta.outstanding_total)}
            note={`${formatNumber(counts.outstanding)} not cleared yet`}
          />
          <Card label="Released, waiting for the bank" value={formatNumber(counts.released)} note="Handed over, not cleared" />
          <Card
            label="Going stale within 30 days"
            value={formatNumber(meta.stale_soon)}
            note={meta.stale_soon ? 'Ask the payee to deposit them' : 'None'}
            tone={meta.stale_soon ? 'warning' : null}
            onClick={meta.stale_soon ? () => go({ view: 'outstanding', sort: 'stale_soon', page: '1' }) : undefined}
          />
          <Card label="Cleared" value={formatMoney(meta.cleared_total)} note={`${formatNumber(counts.cleared)} paid by the bank`} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
          {VIEWS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={view === t.key}
              onClick={() => go({ view: t.key, page: '1' })}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-lg px-3',
                view === t.key ? 'text-auth-button bg-primary text-primary-foreground' : 'text-body-strong hover:bg-muted',
              )}
            >
              {t.label}
              {counts && <span className={cn('text-caption', view === t.key && 'text-primary-foreground/80')}>{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cheque no., payee, voucher"
            aria-label="Search cheques"
            maxLength={100}
            className="text-body h-10 w-full rounded-lg border bg-card pr-8 pl-9 outline-none focus:border-primary focus:ring-[0.5px] focus:ring-primary"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => go({ sort: e.target.value, page: '1' })}
          aria-label="Sort"
          className="text-body h-10 rounded-lg border bg-card px-3 outline-none focus:border-primary"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card" aria-label="Cheques">
        {status === 'loading' && (
          <div role="status" aria-label="Loading" className="flex flex-col">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}
        {status === 'error' && (
          <ErrorState
            title="Couldn’t load the cheques"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {status === 'success' && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <NotebookTabs className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-card-title">{search ? `No cheques match “${search}”` : emptyTitle(view)}</p>
            <p className="text-caption max-w-md">
              {search
                ? 'Check the cheque number, or search all statuses.'
                : isClerk
                  ? 'Record a cheque on an approved voucher that is paid by cheque.'
                  : 'Cheques appear here once clerks record them on approved vouchers.'}
            </p>
            {search && view !== 'all' && (
              <button type="button" onClick={() => go({ view: 'all', page: '1' })} className={cn(small, 'mt-1')}>
                Search all statuses
              </button>
            )}
          </div>
        )}
        {status === 'success' && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead className="border-b bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Cheque</th>
                  <th className="px-4 py-2.5 font-semibold">Payee</th>
                  <th className="px-4 py-2.5 font-semibold">Voucher</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  {isClerk && <th className="px-4 py-2.5 font-semibold">Next step</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="text-body border-b align-top last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.cheque_number}</p>
                      <p className="text-caption">
                        {c.bank_name} · {formatDate(c.cheque_date, 'MMM d, yyyy')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[220px] truncate">{c.payee_name}</p>
                      {c.received_by && <p className="text-caption">Received by {c.received_by}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {isClerk ? (
                        <Link to={`${PATHS.CLERK_VOUCHERS}/${c.voucher.id}`} className="text-primary hover:underline">
                          {c.voucher.number}
                        </Link>
                      ) : (
                        c.voucher.number
                      )}
                      {!isClerk && c.recorded_by && <p className="text-caption">By {c.recorded_by}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(c.amount)}</td>
                    <td className="px-4 py-3">
                      <ChequeStatusPill cheque={c} />
                      <p className={cn('text-caption mt-1', c.days_left != null && c.days_left <= 30 && 'font-medium text-warning')}>
                        {statusNote(c)}
                      </p>
                    </td>
                    {isClerk && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {c.can.release && (
                            <button type="button" onClick={() => setDialog({ mode: 'release', cheque: c })} className={small}>
                              Release
                            </button>
                          )}
                          {c.can.clear && (
                            <button type="button" onClick={() => setDialog({ mode: 'clear', cheque: c })} className={small}>
                              Mark cleared
                            </button>
                          )}
                          {c.can.cancel && (
                            <button
                              type="button"
                              onClick={() => setDialog({ mode: 'cancel', cheque: c })}
                              className={cn(small, 'border-transparent text-danger hover:bg-danger-soft')}
                            >
                              Cancel
                            </button>
                          )}
                          {!c.can.release && !c.can.clear && !c.can.cancel && <span className="text-caption">—</span>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                className={cn(small, 'disabled:opacity-50')}
              >
                ‹
              </button>
              Page {meta.current_page} of {meta.last_page}
              <button
                type="button"
                disabled={page >= meta.last_page}
                onClick={() => go({ page: String(page + 1) })}
                className={cn(small, 'disabled:opacity-50')}
              >
                ›
              </button>
            </span>
          </nav>
        )}
      </section>

      <AnimatePresence>
        {dialog && (
          <ChequeDialog mode={dialog.mode} cheque={dialog.cheque} onDone={() => setAttempt((n) => n + 1)} onClose={() => setDialog(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function emptyTitle(view) {
  return {
    outstanding: 'No outstanding cheques',
    issued: 'No cheques waiting to be released',
    released: 'No released cheques waiting for the bank',
    cleared: 'No cleared cheques yet',
    stale: 'No stale cheques',
    cancelled: 'No cancelled cheques',
    all: 'No cheques recorded yet',
  }[view]
}

function statusNote(c) {
  if (c.status === 'cleared') return `Cleared ${formatDate(c.cleared_on, 'MMM d, yyyy')}`
  if (c.status === 'cancelled') return c.cancel_reason ? `“${c.cancel_reason}”` : 'Cancelled'
  if (c.status === 'stale') return `Stale since ${formatDate(c.stale_on, 'MMM d, yyyy')}`
  return staleHint(c)
}

function Card({ label, value, note, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3 text-left',
        tone === 'warning' && 'border-warning/40 bg-warning-soft',
        onClick && 'outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'warning' && 'text-warning')}>{value}</span>
      <span className="text-caption">{note}</span>
    </Tag>
  )
}

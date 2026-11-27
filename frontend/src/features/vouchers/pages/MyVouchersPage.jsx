import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileText, Flag, Plus, Search, SearchX, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listVouchers } from '../api'
import { SORTS, statusPill, VIEWS, VOUCHERS_CHANGED_EVENT } from '../utils'

/**
 * My vouchers (/clerk/vouchers): the clerk's own vouchers in the company they're working in.
 * Tabs (All, Drafts, In review, Returned, Approved, Rejected, Cancelled), search (number, payee,
 * description, reference or an amount), sort, 20 a page. Everything is in the address
 * (?view=draft&q=pldt&sort=amount_desc&page=2), so the sidebar's Drafts / Returned links open the right tab.
 */
export default function MyVouchersPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const view = params.get('view')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'recent'
  const page = Number(params.get('page')) || 1

  const [searchText, setSearchText] = useState(search)
  const debounced = useDebounce(searchText.trim(), 300)

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

  useEffect(() => {
    if (debounced !== search) update({ q: debounced })
  }, [debounced, search, update])

  // the list for the current filters + company (an older answer arriving late is ignored)
  const key = JSON.stringify([companyId, view, search, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', vouchers: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    const id = ++requestRef.current
    const load = (quiet) =>
      listVouchers({ view, search, sort: sort === 'recent' ? null : sort, page })
        .then(({ vouchers, meta }) => id === requestRef.current && setState({ key, status: 'success', vouchers, meta, error: null }))
        .catch((error) => id === requestRef.current && !quiet && setState((p) => ({ ...p, key, status: 'error', error })))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
  }, [key, view, search, sort, page, attempt])

  const current = state.key === key
  const status = current ? state.status : 'loading'
  const meta = state.meta
  const filtered = Boolean(search || view)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">My vouchers</h1>
          <p className="text-body text-muted-foreground">Vouchers you made in this company.</p>
        </div>
        <Link
          to={PATHS.CLERK_VOUCHER_NEW}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" /> Create voucher
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="tablist" aria-label="Views" className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-card p-[3px]">
          {VIEWS.map((v) => {
            const active = (view ?? null) === v.key
            const amber = active && v.tone === 'warning'
            return (
              <button
                key={v.count}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => update({ view: v.key })}
                className={cn(
                  'flex h-8 shrink-0 items-center rounded-md px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active ? 'text-badge' : 'text-caption hover:bg-muted',
                  active && (amber ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'),
                )}
              >
                {v.label}
                {meta?.counts && ` ${meta.counts[v.count] ?? 0}`}
              </button>
            )
          })}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:w-[260px] sm:flex-none">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxLength={100}
              placeholder="Search number, payee, amount…"
              aria-label="Search your vouchers"
              className="text-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
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
          <label className="relative">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'recent' ? null : e.target.value })}
              className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-9 pl-3 outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
        </div>
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading vouchers" className="flex flex-col rounded-xl border bg-card">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your vouchers"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && state.vouchers.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={filtered ? SearchX : FileText}
            title={search ? `Nothing matches “${search}”` : filtered ? 'No vouchers here' : 'No vouchers yet'}
            description={filtered ? 'Try another tab or search.' : 'Create your first voucher. It stays a draft until you submit it.'}
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchText('')
                    update({ q: null, view: null })
                  }}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show all vouchers
                </button>
              ) : (
                <Link
                  to={PATHS.CLERK_VOUCHER_NEW}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" aria-hidden="true" /> Create voucher
                </Link>
              )
            }
          />
        </div>
      )}

      {status === 'success' && state.vouchers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-table-head border-b bg-muted text-muted-foreground">
                <th scope="col" className="px-4 py-2.5">
                  Voucher · payee
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Updated
                </th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.vouchers.map((v) => {
                const pill = statusPill(v.status)
                const open = () => navigate(`${PATHS.CLERK_VOUCHERS}/${v.id}`)
                return (
                  <tr key={v.id} onClick={open} className="cursor-pointer border-b last:border-b-0 hover:bg-primary-faint">
                    <td className="px-4 py-3">
                      <Link
                        to={`${PATHS.CLERK_VOUCHERS}/${v.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-body-strong flex flex-wrap items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {v.voucher_number ?? <span className="text-caption">Draft · no number yet</span>}
                        {v.ai_flagged && (
                          <span className="text-badge flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-danger">
                            <Flag className="size-3" aria-hidden="true" /> Flagged
                          </span>
                        )}
                      </Link>
                      <span className="text-caption block">
                        {[v.payee_name ?? 'No payee yet', v.category?.name].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td className="text-body-strong px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatMoney(v.amount)}</td>
                    <td className="px-4 py-3">
                      <Pill tone={pill.tone}>{pill.text}</Pill>
                    </td>
                    <td className="text-caption px-4 py-3 whitespace-nowrap" title={formatDate(v.updated_at, 'MMM d, yyyy h:mm a')}>
                      {formatTimeAgo(v.updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'voucher', 'vouchers')}
          </p>
          {meta.last_page > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.current_page <= 1}
                onClick={() => update({ page: meta.current_page - 1 > 1 ? meta.current_page - 1 : null }, { keepPage: true })}
                className="text-body-strong h-[34px] rounded-lg border bg-card px-3 hover:bg-muted disabled:opacity-50"
              >
                ‹ Previous
              </button>
              <span aria-current="page">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <button
                type="button"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => update({ page: meta.current_page + 1 }, { keepPage: true })}
                className="text-body-strong h-[34px] rounded-lg border bg-card px-3 hover:bg-muted disabled:opacity-50"
              >
                Next ›
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

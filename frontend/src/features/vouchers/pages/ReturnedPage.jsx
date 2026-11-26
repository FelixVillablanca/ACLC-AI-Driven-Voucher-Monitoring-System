import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { PATHS } from '@/lib/constants'
import { plural } from '@/lib/formatters'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listVouchers } from '../api'
import ReturnedCard from '../components/ReturnedCard'
import { RETURNED_SORTS, VOUCHERS_CHANGED_EVENT } from '../utils'

const createClass =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50'
const pagerClass = 'text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50'

/**
 * Returned to me (/clerk/returned; Framer xRM5FKjDQ list, hCVo9GrUL "all caught up").
 * The clerk's vouchers a reviewer sent back, in the active company, each with the reviewer's latest note.
 * Sorted by when they came back, oldest first (the ones waiting longest on top); ?sort=&page= in the address.
 * Fix & resubmit opens the voucher form in its "returned" layout (Framer EWrCKOIlI).
 */
export default function ReturnedPage() {
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const page = Number(params.get('page')) || 1
  const sort = RETURNED_SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'returned_oldest'

  const key = JSON.stringify([companyId, sort, page])
  const [state, setState] = useState({ key: null, status: 'loading', vouchers: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    const id = ++requestRef.current
    const load = (quiet) =>
      listVouchers({ view: 'returned', sort, page })
        .then(({ vouchers, meta }) => id === requestRef.current && setState({ key, status: 'success', vouchers, meta, error: null }))
        .catch((error) => id === requestRef.current && !quiet && setState((p) => ({ ...p, key, status: 'error', error })))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
  }, [key, sort, page, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { vouchers, meta } = state
  const total = meta?.total ?? 0

  // a page emptied by resubmitting → step back one page
  useEffect(() => {
    if (status === 'success' && vouchers.length === 0 && page > 1) setParams({ sort, page: String(page - 1) }, { replace: true })
  }, [status, vouchers.length, page, sort, setParams])

  const update = (next) => {
    const merged = { sort, page: String(page), ...next }
    const clean = {}
    if (merged.sort !== 'returned_oldest') clean.sort = merged.sort
    if (Number(merged.page) > 1) clean.page = merged.page
    setParams(clean, { replace: true })
  }

  const hasRows = status === 'success' && vouchers.length > 0

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Returned to me</h1>
          <p className="text-body text-muted-foreground">
            {hasRows
              ? `${plural(total, 'voucher needs', 'vouchers need')} your changes before ${total === 1 ? 'it' : 'they'} can continue`
              : 'Vouchers sent back by Accounting or a Supervisor for changes'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasRows && total > 1 && (
            <label className="relative">
              <span className="sr-only">Sort</span>
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value, page: '1' })}
                className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-9 pl-3.5 outline-none focus:border-primary"
              >
                {RETURNED_SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </label>
          )}
          <Link to={PATHS.CLERK_VOUCHER_NEW} className={createClass}>
            <Plus className="size-4" aria-hidden="true" /> Create voucher
          </Link>
        </div>
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading returned vouchers" className="flex flex-col gap-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] py-4">
              <div className="flex justify-between">
                <div className="h-5 w-56 animate-pulse rounded bg-muted" />
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
              <div className="flex justify-end gap-2">
                <div className="h-[34px] w-24 animate-pulse rounded-lg bg-muted" />
                <div className="h-[34px] w-32 animate-pulse rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your returned vouchers"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && vouchers.length === 0 && page === 1 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 pt-[72px] pb-[76px] text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-success-soft">
            <Check className="size-7 text-success" aria-hidden="true" />
          </div>
          <p className="text-card-title">You’re all caught up</p>
          <p className="text-body max-w-md text-muted-foreground">
            No vouchers need changes right now. We’ll notify you if a reviewer sends one back.
          </p>
          <Link to={PATHS.CLERK_VOUCHERS} className={createClass}>
            View my vouchers →
          </Link>
        </div>
      )}

      {hasRows && (
        <div className="flex flex-col gap-3.5">
          {vouchers.map((v) => (
            <ReturnedCard key={v.id} voucher={v} />
          ))}
        </div>
      )}

      {hasRows && meta?.last_page > 1 && (
        <nav aria-label="Pages" className="text-caption flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className={pagerClass}>
            ‹
          </button>
          <span aria-current="page">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <button type="button" disabled={page >= meta.last_page} onClick={() => update({ page: String(page + 1) })} className={pagerClass}>
            ›
          </button>
        </nav>
      )}
    </div>
  )
}

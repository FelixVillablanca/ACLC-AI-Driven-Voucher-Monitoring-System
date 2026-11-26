import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Download, Loader2, Plus, Search, Users, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { useDismiss } from '@/hooks/useDismiss'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { exportPayees, listPayees } from '../api'
import PayeeFormModal from '../components/PayeeFormModal'
import PayeePanel, { Avatar } from '../components/PayeePanel'
import { PAY_VIA, PAYEES_CHANGED_EVENT, SORTS, typeTone } from '../utils'

const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60'
const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60'
const pagerBtn = 'text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50'

/**
 * Payees (/clerk/payees; Framer jbj8yIDz9 list, GZb92vr4M side panel, UKm7GrwEZ Add payee), 2026-11-26.
 * The company's payee list, shared by its clerks. Type chips (from the Admin's payee types), search
 * (name, TIN, account number, email), sort, 20 a page. Everything is in the address:
 * ?type=&status=inactive&q=&sort=&page=&payee={id} (side panel) &add=1 (Add payee).
 * The Vouchers / Approved / Last used columns count only the signed-in clerk's own vouchers.
 */
export default function PayeesPage() {
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const companies = useAuthStore((s) => s.user?.companies)
  const company = companies?.find((c) => c.id === companyId)?.name

  const type = params.get('type') || null
  const status = params.get('status') === 'inactive' ? 'inactive' : null
  const sort = SORTS.some((s) => s.key === params.get('sort')) ? params.get('sort') : 'most_used'
  const page = Number(params.get('page')) || 1
  const q = params.get('q') ?? ''
  const openId = Number(params.get('payee')) || null
  const adding = params.get('add') === '1'

  const update = (next, { keepPage = false } = {}) => {
    const merged = {
      type,
      status,
      sort,
      q,
      page: keepPage ? String(page) : '1',
      payee: params.get('payee'),
      add: params.get('add'),
      ...next,
    }
    const clean = {}
    if (merged.type) clean.type = merged.type
    if (merged.status) clean.status = merged.status
    if (merged.sort && merged.sort !== 'most_used') clean.sort = merged.sort
    if (merged.q) clean.q = merged.q
    if (Number(merged.page) > 1) clean.page = merged.page
    if (merged.payee) clean.payee = merged.payee
    if (merged.add) clean.add = merged.add
    setParams(clean, { replace: true })
  }

  // search box: typed text → address after a pause
  const [searchText, setSearchText] = useState(q)
  const debounced = useDebounce(searchText, 350)
  useEffect(() => {
    if (debounced.trim() !== q) update({ q: debounced.trim() || null })
    // only when the typed text settles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const key = JSON.stringify([companyId, type, status, sort, q, page])
  const [state, setState] = useState({ key: null, status: 'loading', payees: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    const id = ++requestRef.current
    const load = (quiet) =>
      listPayees({ status, type, search: q, sort, page })
        .then(({ payees, meta }) => id === requestRef.current && setState({ key, status: 'success', payees, meta, error: null }))
        .catch((error) => id === requestRef.current && !quiet && setState((p) => ({ ...p, key, status: 'error', error })))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(PAYEES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PAYEES_CHANGED_EVENT, onChanged)
  }, [key, status, type, q, sort, page, attempt])

  const loadStatus = state.key === key ? state.status : 'loading'
  const { payees, meta } = state
  const counts = meta?.counts
  const types = counts?.types ?? []
  const filtering = Boolean(type || q)

  // Add / Edit form (edit is local state; add is in the address so the voucher form can link here)
  const [editing, setEditing] = useState(null)
  const closeForm = () => (editing ? setEditing(null) : update({ add: null }, { keepPage: true }))

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Payees</h1>
          <p className="text-body text-muted-foreground">
            People and businesses you can pay from {company ?? 'this company'}
            {counts && ` · ${counts.active} active`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {counts && counts.active + counts.inactive > 0 && <ExportMenu filters={{ status, type, search: q, sort }} />}
          <button type="button" onClick={() => update({ add: '1' }, { keepPage: true })} className={primaryBtn} disabled={!counts}>
            <Plus className="size-4" aria-hidden="true" /> Add payee
          </button>
        </div>
      </div>

      {counts && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payee type">
          <Chip active={!type} onClick={() => update({ type: null })}>
            All types · {counts.all}
          </Chip>
          {types.map((t) => (
            <Chip key={t.id} active={type === String(t.id)} onClick={() => update({ type: String(t.id) })}>
              {t.name} · {t.count}
            </Chip>
          ))}
          {counts.none > 0 && (
            <Chip active={type === 'none'} onClick={() => update({ type: 'none' })}>
              No type · {counts.none}
            </Chip>
          )}
          {(counts.inactive > 0 || status) && (
            <Chip active={Boolean(status)} onClick={() => update({ status: status ? null : 'inactive', type: null })} className="ml-auto">
              {status ? '← Active payees' : `Deactivated · ${counts.inactive}`}
            </Chip>
          )}
        </div>
      )}

      <section className="flex flex-col overflow-hidden rounded-xl border bg-card" aria-label="Payee list">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="flex h-[38px] min-w-[220px] flex-1 items-center gap-2 rounded-lg border bg-muted px-3 focus-within:border-primary">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search payee name, TIN or bank account…"
              aria-label="Search payees"
              className="text-body w-full bg-transparent outline-none placeholder:text-muted-foreground"
              maxLength={100}
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
              onChange={(e) => update({ sort: e.target.value })}
              className="text-body h-[38px] appearance-none rounded-lg border bg-card pr-9 pl-3 outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
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
        </div>

        {loadStatus === 'loading' && (
          <div role="status" aria-label="Loading payees" className="flex flex-col border-t">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <div className="size-8 animate-pulse rounded-full bg-muted" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {loadStatus === 'error' && (
          <div className="border-t">
            <ErrorState
              title="Couldn't load the payees"
              message={state.error.message}
              requestId={state.error.requestId}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          </div>
        )}

        {loadStatus === 'success' && payees.length === 0 && (
          <div className="flex flex-col items-center gap-3 border-t px-6 py-14 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft">
              <Users className="size-6 text-primary" aria-hidden="true" />
            </div>
            {filtering || status ? (
              <>
                <p className="text-card-title">{status ? 'No deactivated payees match' : 'No payees match'}</p>
                <p className="text-body max-w-md text-muted-foreground">
                  {q ? `Nothing found for “${q}”` : 'Nothing in this type'}. Try another search or show all types.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchText('')
                    update({ q: null, type: null })
                  }}
                  className={outlineBtn}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-card-title">No payees yet</p>
                <p className="text-body max-w-md text-muted-foreground">
                  Add the people and businesses your company pays, so vouchers can fill in their type and payment details for you.
                </p>
                {types.length === 0 ? (
                  <p className="text-caption">Your Admin needs to add payee types first (Configuration → Categories → Payee types).</p>
                ) : (
                  <button type="button" onClick={() => update({ add: '1' })} className={primaryBtn}>
                    <Plus className="size-4" aria-hidden="true" /> Add your first payee
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {loadStatus === 'success' && payees.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-y bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Payee</th>
                  <th className="w-[130px] px-3 py-2.5 font-semibold">Type</th>
                  <th className="w-[120px] px-3 py-2.5 font-semibold">Pay via</th>
                  <th className="w-[90px] px-3 py-2.5 text-right font-semibold">Vouchers</th>
                  <th className="w-[150px] px-3 py-2.5 text-right font-semibold" title="Total of your approved vouchers this year">
                    Approved YTD
                  </th>
                  <th className="w-[100px] px-4 py-2.5 font-semibold">Last used</th>
                </tr>
              </thead>
              <tbody>
                {payees.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => update({ payee: String(p.id) }, { keepPage: true })}
                    className={cn(
                      'cursor-pointer border-b last:border-b-0 hover:bg-muted',
                      openId === p.id && 'bg-primary-faint hover:bg-primary-faint',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} tone={typeTone(p.type?.name)} size="size-8" />
                        <div className="flex min-w-0 flex-col gap-px">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              update({ payee: String(p.id) }, { keepPage: true })
                            }}
                            className="text-body-strong truncate text-left outline-none hover:underline focus-visible:underline"
                          >
                            {p.name}
                          </button>
                          <span className="text-caption truncate">{p.tin ? `TIN ${p.tin}` : (p.email ?? 'No TIN on file')}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.type ? <Pill tone={typeTone(p.type.name)}>{p.type.name}</Pill> : <span className="text-caption">No type</span>}
                    </td>
                    <td className="text-body px-3 py-2.5">
                      {PAY_VIA[p.default_payment_method] ?? <span className="text-caption">Not set</span>}
                    </td>
                    <td className="text-body px-3 py-2.5 text-right tabular-nums">{p.stats.vouchers_count}</td>
                    <td className="text-body-strong px-3 py-2.5 text-right tabular-nums">{formatMoney(p.stats.approved_ytd)}</td>
                    <td className="text-caption px-4 py-2.5">
                      {p.stats.last_used_at ? formatDate(p.stats.last_used_at, 'MMM d') : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loadStatus === 'success' && meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t px-4 py-3">
            <p className="text-caption">
              Showing {meta.from}–{meta.to} of {plural(meta.total, 'payee', 'payees')} · Numbers count your own vouchers · Need a new payee
              type? Ask your administrator.
            </p>
            {meta.last_page > 1 && (
              <nav aria-label="Pages" className="text-caption flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className={pagerBtn}>
                  ‹
                </button>
                <span aria-current="page">
                  Page {meta.current_page} of {meta.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.last_page}
                  onClick={() => update({ page: String(page + 1) })}
                  className={pagerBtn}
                >
                  Next page →
                </button>
              </nav>
            )}
          </div>
        )}
      </section>

      <p className="text-caption">
        Paying someone new?{' '}
        <Link to={PATHS.CLERK_VOUCHER_NEW} className="text-auth-link text-primary hover:underline">
          Create a voucher
        </Link>{' '}
        and type their name; it links to a saved payee when the name matches.
      </p>

      <AnimatePresence>
        {openId && !editing && !adding && (
          <PayeePanel key={openId} id={openId} onClose={() => update({ payee: null }, { keepPage: true })} onEdit={(p) => setEditing(p)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {(adding || editing) && counts && (
          <PayeeFormModal
            key={editing?.id ?? 'new'}
            payee={editing}
            types={types}
            companyName={company}
            prefillName={params.get('name') ?? ''}
            onClose={closeForm}
            onSaved={(saved) => {
              setEditing(null)
              update({ add: null, payee: String(saved.id) }, { keepPage: true })
            }}
            onUseExisting={(id) => {
              setEditing(null)
              update({ add: null, payee: String(id) }, { keepPage: true })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Chip({ active, onClick, className, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'h-9 rounded-lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'text-auth-button bg-primary text-primary-foreground' : 'text-body-strong border bg-card hover:bg-muted',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** "Export list" → CSV or Excel of what the list shows (same filters and order). */
function ExportMenu({ filters }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const ref = useRef(null)
  useDismiss(open, ref, () => setOpen(false))

  const run = async (format) => {
    setBusy(format)
    try {
      const name = await exportPayees({ format, ...filters })
      toast.success(`Saved ${name}.`)
      setOpen(false)
    } catch (e) {
      toast.error(e.message || 'Couldn’t export the list.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className={outlineBtn}>
        <Download className="size-4" aria-hidden="true" /> Export list
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1.5 flex w-52 flex-col rounded-lg border bg-card p-1 shadow-lg">
          {[
            ['csv', 'CSV (.csv)'],
            ['xlsx', 'Excel (.xlsx)'],
          ].map(([format, label]) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled={Boolean(busy)}
              onClick={() => run(format)}
              className="text-body flex h-9 items-center gap-2 rounded-md px-2.5 text-left hover:bg-muted disabled:opacity-60"
            >
              {busy === format && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {label}
            </button>
          ))}
          <p className="text-caption border-t px-2.5 pt-1.5 pb-1">Includes bank details. Keep the file private.</p>
        </div>
      )}
    </div>
  )
}

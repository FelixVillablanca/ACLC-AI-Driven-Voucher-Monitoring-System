import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays, ChevronRight, Download, Loader2, ScrollText, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { exportSupervisorAudit, listSupervisorAudit } from '../api'
import AuditEntryDrawer from '../components/AuditEntryDrawer'
import Pager from '../components/Pager'
import { outlineBtn, shortName } from '../utils'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom dates…' },
]
const today = () => new Date().toLocaleDateString('en-CA') // yyyy-mm-dd, local time

/**
 * AUDIT TRAIL for the Supervisor / Manager (/supervisor/audit; Framer xqItzoFYK list + cm5eFM0vJ entry), 2026-11-27.
 * Read-only: every voucher, approval, budget, report and forecast event of the company, newest first. Date range
 * (today / 7 / 30 / 90 days / custom), search, User / Action / Table filters, 25 a page, Export log (CSV of what's
 * filtered). A row opens the entry panel (?entry=). Everything is kept in the address.
 * Code differs from the frame: the first card counts the chosen dates (not always "this week"); "Sensitive changes"
 * are the ⚑ actions of the catalog (budget edits); the automatic check shows as "System" (not "System (AI)").
 */
export default function SupervisorAuditPage() {
  usePageTitle('Audit trail')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const custom = !!(from || to) || params.get('range') === 'custom'
  const range = custom ? 'custom' : RANGES.some((r) => r.key === params.get('range')) ? params.get('range') : '7d'
  const user = params.get('user') || ''
  const action = params.get('action') || ''
  const table = params.get('table') || ''
  const page = Number(params.get('page')) || 1
  const entry = Number(params.get('entry')) || null
  const [text, setText] = useState(params.get('q') ?? '')
  const search = useDebounce(text.trim(), 300)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const filters = {
    range: custom ? undefined : range,
    from: custom ? from || undefined : undefined,
    to: custom ? to || undefined : undefined,
    search,
    user,
    action,
    table,
  }
  const key = JSON.stringify([companyId, filters, page, attempt])

  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, String(v))))
        return p
      },
      { replace: true },
    )

  useEffect(() => {
    if ((params.get('q') ?? '') !== search) setParam({ q: search || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const ctrl = new AbortController()
    listSupervisorAudit({ ...JSON.parse(key)[1], page, signal: ctrl.signal })
      .then((data) => setState({ key, status: 'success', data, error: null }))
      .catch((error) => !ctrl.signal.aborted && setState({ key, status: 'error', data: null, error }))
    return () => ctrl.abort()
  }, [key, page])

  const status = state.key === key ? state.status : 'loading'
  const d = state.data // the last answer stays (dimmed) while the next one loads
  const meta = d?.meta
  const sum = meta?.summary
  const opts = meta?.options
  const filtered = !!(search || user || action || table)

  const onExport = async () => {
    setExporting(true)
    try {
      toast.success(`Saved ${await exportSupervisorAudit(filters)}.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(false)
    }
  }
  const clear = () => {
    setText('')
    setParam({ q: null, user: null, action: null, table: null, page: null })
  }
  const periodText = !meta
    ? ''
    : range === 'today'
      ? 'today'
      : custom
        ? `${formatDate(meta.range.from ?? meta.range.to, 'MMM d')} – ${formatDate(meta.range.to, 'MMM d')}`
        : RANGES.find((r) => r.key === range).label.toLowerCase()

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Audit trail</h1>
          <p className="text-body text-muted-foreground">Every change to vouchers, budgets and approvals · read-only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="sv-audit-range" className="sr-only">
              Dates
            </label>
            <select
              id="sv-audit-range"
              value={range}
              onChange={(e) =>
                e.target.value === 'custom'
                  ? setParam({ range: 'custom', from: today(), to: today(), page: null })
                  : setParam({ range: e.target.value === '7d' ? null : e.target.value, from: null, to: null, page: null })
              }
              className={cn(inputClass, 'h-[38px] w-auto pr-8 pl-9')}
            >
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {custom && (
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="sv-audit-from">
                From
              </label>
              <input
                id="sv-audit-from"
                type="date"
                value={from}
                max={to || today()}
                onChange={(e) => setParam({ range: 'custom', from: e.target.value, page: null })}
                className={cn(inputClass, 'h-[38px] w-[150px]')}
              />
              <span className="text-caption">to</span>
              <label className="sr-only" htmlFor="sv-audit-to">
                To
              </label>
              <input
                id="sv-audit-to"
                type="date"
                value={to}
                min={from || undefined}
                max={today()}
                onChange={(e) => setParam({ range: 'custom', to: e.target.value, page: null })}
                className={cn(inputClass, 'h-[38px] w-[150px]')}
              />
            </div>
          )}
          <button type="button" onClick={onExport} disabled={exporting || !meta || meta.total === 0} className={outlineBtn}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {exporting ? 'Exporting…' : 'Export log'}
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card
          label={`Events · ${periodText || '…'}`}
          value={sum ? formatNumber(sum.events) : '—'}
          caption={sum ? `across ${plural(sum.people, 'person', 'people')}` : ' '}
        />
        <Card label="Approvals & rejections" value={sum ? formatNumber(sum.decisions) : '—'} caption="Level 1 and Level 2, incl. returns" />
        <Card
          label="Sensitive changes"
          value={sum ? formatNumber(sum.sensitive) : '—'}
          caption="Budget edits"
          tone={sum?.sensitive ? 'warning' : undefined}
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={120}
              placeholder="Search by user, record or voucher no.…"
              aria-label="Search the audit trail"
              className={cn(inputClass, 'h-9 pr-8 pl-9')}
            />
            {text && (
              <button
                type="button"
                onClick={() => setText('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <Filter label="User" value={user} onChange={(v) => setParam({ user: v, page: null })}>
            {(opts?.users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Filter>
          <Filter label="Action" value={action} onChange={(v) => setParam({ action: v, page: null })}>
            {(opts?.actions ?? []).map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </Filter>
          <Filter label="Table" value={table} onChange={(v) => setParam({ table: v, page: null })}>
            {(opts?.tables ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Filter>
        </div>

        {status === 'loading' && !d && (
          <div role="status" aria-label="Loading the audit trail" className="h-[360px] animate-pulse bg-muted/40" />
        )}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load the audit trail"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {status !== 'error' && d && d.entries.length === 0 && (
          <EmptyState
            icon={ScrollText}
            title={filtered ? 'No events match these filters' : `No events ${periodText}`}
            description={
              filtered
                ? 'Try another search or filter, or a longer date range.'
                : 'Voucher, approval and budget activity appears here as it happens.'
            }
            action={
              filtered ? (
                <button type="button" onClick={clear} className="text-auth-link text-primary hover:underline">
                  Clear filters
                </button>
              ) : null
            }
          />
        )}
        {status !== 'error' && d && d.entries.length > 0 && (
          <div className={cn('overflow-x-auto transition-opacity', status === 'loading' && 'opacity-60')} aria-busy={status === 'loading'}>
            <table className="w-full min-w-[860px] text-left">
              <thead className="border-b bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="w-[130px] px-4 py-2.5 font-semibold">Time</th>
                  <th className="w-[150px] px-3 py-2.5 font-semibold">User</th>
                  <th className="w-[200px] px-3 py-2.5 font-semibold">Action</th>
                  <th className="px-3 py-2.5 font-semibold">Record</th>
                  <th className="w-[130px] px-3 py-2.5 font-semibold">IP address</th>
                  <th className="w-10 px-2 py-2.5" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setParam({ entry: e.id })}
                    className={cn('cursor-pointer border-b last:border-b-0 hover:bg-muted', entry === e.id && 'bg-primary-faint')}
                  >
                    <td className="text-caption px-4 py-2.5 whitespace-nowrap tabular-nums">{formatDate(e.at, 'MMM d · HH:mm')}</td>
                    <td className="text-body px-3 py-2.5">
                      {e.who.kind === 'person' ? shortName(e.who.name) : e.who.name}
                      {e.who.is_you && <span className="text-caption"> (you)</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={e.action.tone}>
                        {e.action.sensitive ? '⚑ ' : ''}
                        {e.action.label}
                      </Pill>
                    </td>
                    <td className="text-body px-3 py-2.5">
                      <span className="text-body-strong">{e.record.title}</span>
                      {e.record.subtitle && <span className="text-caption"> · {e.record.subtitle}</span>}
                    </td>
                    <td className="text-caption px-3 py-2.5 tabular-nums">{e.ip ?? '—'}</td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        aria-label={`Open entry #${e.id}`}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setParam({ entry: e.id })
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status !== 'error' && meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
            <p className="text-caption">
              Showing {meta.from}–{meta.to} of {plural(meta.total, 'event', 'events')}
            </p>
            {meta.last_page > 1 && (
              <Pager page={meta.current_page} last={meta.last_page} onPage={(p) => setParam({ page: p > 1 ? p : null })} />
            )}
          </div>
        )}
      </section>

      <AnimatePresence>{entry && <AuditEntryDrawer key={entry} id={entry} onClose={() => setParam({ entry: null })} />}</AnimatePresence>
    </div>
  )
}

function Card({ label, value, caption, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-[18px] py-4">
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'warning' && 'text-warning')}>{value}</span>
      <span className="text-caption">{caption}</span>
    </div>
  )
}

function Filter({ label, value, onChange, children }) {
  const id = `sv-audit-${label.toLowerCase()}`
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-caption">
        {label}:
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(inputClass, 'h-9 w-auto max-w-[200px] pr-8')}
      >
        <option value="">All</option>
        {children}
      </select>
    </div>
  )
}

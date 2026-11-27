import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Download, History, Loader2, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { useDebounce } from '@/hooks/useDebounce'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { exportMyDecisions, listMyDecisions } from '../api'
import Pager from '../components/Pager'
import { DECISIONS_CHANGED_EVENT, level2Path, outlineBtn } from '../utils'

const ACTIONS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'approved', label: 'Approved', count: 'approved' },
  { key: 'returned', label: 'Returned', count: 'returned' },
  { key: 'rejected', label: 'Rejected', count: 'rejected' },
]
const PILL = { approved: ['success', 'Approved'], returned: ['warning', 'Returned'], rejected: ['danger', 'Rejected'] }

/** "2026-11" → "Nov 2026" (long: "November 2026") */
function monthLabel(m, long = false) {
  if (!m || m === 'all') return 'All months'
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: 'numeric' })
}

/** 5.2 → "5.2 hrs", 0.4 → "24 min" */
function hoursText(h) {
  if (h === null || h === undefined) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  return `${h.toFixed(1)} ${h === 1 ? 'hr' : 'hrs'}`
}

/**
 * DECISION HISTORY (/supervisor/history; Framer K_vQYIg74, 2026-11-27). Every Level 2 decision you made in this company,
 * one month at a time (or all months), newest first. 3 cards for the month: decisions (by kind), average decision time
 * (Level 1 approval → your decision) vs the month before, flags overridden (approved while flagged) and whether each has
 * remarks. Tabs with counts, search (voucher no. or payee), Export CSV of what's shown (audit `decisions_exported`).
 * Address: ?month=&action=&q=&page=.
 * Code differs from the frame: "Flags overridden" = approved while flagged by the automatic check (not an AI model);
 * the remarks column also shows who a return went to and the reject reason.
 */
export default function DecisionHistoryPage() {
  usePageTitle('Decision history')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const month = params.get('month') || null // null = this month (the server's default)
  const action = ACTIONS.some((a) => a.key && a.key === params.get('action')) ? params.get('action') : null
  const page = Number(params.get('page')) || 1
  const [text, setText] = useState(params.get('q') ?? '')
  const search = useDebounce(text.trim(), 300)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const key = JSON.stringify([companyId, month, action, search, page, attempt])

  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, String(v))))
        return p
      },
      { replace: true },
    )

  // keep the search in the address (and go back to page 1) once typing stops
  useEffect(() => {
    if ((params.get('q') ?? '') !== search) setParam({ q: search || null, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    const load = () =>
      listMyDecisions({ month, action, search, page, signal: controller.signal })
        .then((data) => alive && setState({ key, status: 'success', data, error: null }))
        .catch((error) => alive && !controller.signal.aborted && setState({ key, status: 'error', data: null, error }))
    load()
    window.addEventListener(DECISIONS_CHANGED_EVENT, load)
    return () => {
      alive = false
      controller.abort()
      window.removeEventListener(DECISIONS_CHANGED_EVENT, load)
    }
  }, [key, month, action, search, page])

  const status = state.key === key ? state.status : 'loading'
  const d = state.data // the last answer stays on screen (dimmed) while the next one loads
  const meta = d?.meta
  const stats = meta?.stats
  const shownMonth = meta?.month ?? month
  const allMonths = month === 'all'
  const counts = stats?.counts

  const onExport = async () => {
    setExporting(true)
    try {
      const name = await exportMyDecisions({ month: month ?? meta?.month, action, search })
      toast.success(`Saved ${name}.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExporting(false)
    }
  }

  const diff =
    stats?.average_hours != null && stats?.previous_average_hours != null ? stats.average_hours - stats.previous_average_hours : null

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Decision history</h1>
          <p className="text-body text-muted-foreground">Every final decision you&apos;ve made at Level 2 · logged to the audit trail</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="history-month" className="sr-only">
            Month
          </label>
          <div className="relative">
            <CalendarDays
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <select
              id="history-month"
              value={month ?? meta?.month ?? ''}
              onChange={(e) => setParam({ month: e.target.value === meta?.months?.[0] ? null : e.target.value, page: null })}
              className={cn(inputClass, 'h-[38px] w-auto pr-8 pl-9')}
            >
              {(meta?.months ?? (month && month !== 'all' ? [month] : [])).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
              <option value="all">All months</option>
            </select>
          </div>
          <button type="button" onClick={onExport} disabled={exporting || !meta || meta.total === 0} className={outlineBtn}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card
          label={allMonths ? 'Decisions (all months)' : `Decisions · ${monthLabel(shownMonth, true)}`}
          value={counts ? counts.all : '—'}
          caption={
            counts
              ? counts.all
                ? `${counts.approved} approved · ${counts.returned} returned · ${counts.rejected} rejected`
                : 'No decisions in this period'
              : ' '
          }
        />
        <Card
          label="Average decision time"
          value={stats ? hoursText(stats.average_hours) : '—'}
          caption={
            !stats ? (
              ' '
            ) : stats.average_hours == null ? (
              'From Level 1 approval to your decision'
            ) : diff == null ? (
              allMonths ? (
                'From Level 1 approval to your decision'
              ) : (
                `No decisions in ${stats.previous_month} to compare`
              )
            ) : Math.abs(diff) < 0.05 ? (
              `Same as ${stats.previous_month}`
            ) : (
              <span className={diff < 0 ? 'text-success' : 'text-danger'}>
                {diff < 0 ? '▼' : '▲'} {hoursText(Math.abs(diff))} {diff < 0 ? 'faster' : 'slower'} than {stats.previous_month}
              </span>
            )
          }
        />
        <Card
          label="Flags overridden"
          value={stats ? stats.overridden : '—'}
          caption={
            !stats
              ? ' '
              : stats.overridden === 0
                ? 'No flagged voucher approved'
                : stats.overridden_with_remarks === stats.overridden
                  ? 'All with written remarks'
                  : `${stats.overridden_with_remarks} of ${stats.overridden} with written remarks`
          }
          tone={stats?.overridden ? 'warning' : undefined}
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Decision filter">
            {ACTIONS.map((a) => {
              const on = action === a.key
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
                  {meta?.counts ? ` · ${meta.counts[a.count]}` : ''}
                </button>
              )
            })}
          </div>
          <div className="relative w-full sm:w-[260px]">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              placeholder="Voucher no., payee…"
              aria-label="Search decisions"
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
        </div>

        {status === 'loading' && !d && <div role="status" aria-label="Loading decisions" className="h-[320px] animate-pulse bg-muted/40" />}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load your decisions"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {status !== 'error' && d && d.reviews.length === 0 && (
          <EmptyState
            icon={History}
            title={
              search ? `No decisions match “${search}”` : action ? `No ${action} vouchers in this period` : 'No decisions in this period'
            }
            description={
              search || action || month
                ? 'Try another month, tab or search.'
                : 'Vouchers you approve, return or reject at Level 2 are listed here.'
            }
            action={
              search || action || month ? (
                <button
                  type="button"
                  onClick={() => {
                    setText('')
                    setParam({ action: null, month: null, q: null, page: null })
                  }}
                  className="text-auth-link text-primary hover:underline"
                >
                  Clear filters
                </button>
              ) : (
                <Link to={PATHS.SUPERVISOR_QUEUE} className="text-auth-link text-primary hover:underline">
                  Open the approval queue →
                </Link>
              )
            }
          />
        )}
        {status !== 'error' && d && d.reviews.length > 0 && (
          <div className={cn('overflow-x-auto transition-opacity', status === 'loading' && 'opacity-60')} aria-busy={status === 'loading'}>
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="w-[120px] px-4 py-2.5 font-semibold">Date</th>
                  <th className="w-[140px] px-3 py-2.5 font-semibold">Voucher</th>
                  <th className="px-3 py-2.5 font-semibold">Payee · Department</th>
                  <th className="w-[130px] px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="w-[120px] px-3 py-2.5 font-semibold">Decision</th>
                  <th className="w-[300px] px-4 py-2.5 font-semibold">Your remarks</th>
                </tr>
              </thead>
              <tbody>
                {d.reviews.map((r) => {
                  const [tone, label] = PILL[r.action] ?? ['neutral', r.action]
                  const extra = [
                    r.sent_to ? `Sent to ${r.sent_to === 'accounting' ? 'Accounting' : 'the clerk'}` : null,
                    r.reason,
                    r.needs_changes?.length ? r.needs_changes.join(', ') : null,
                  ].filter(Boolean)
                  return (
                    <tr key={r.id} className="border-b align-top last:border-b-0">
                      <td className="text-caption px-4 py-3 whitespace-nowrap tabular-nums">{formatDate(r.at, 'MMM d · HH:mm')}</td>
                      <td className="px-3 py-3">
                        <Link to={level2Path(r.voucher.id)} className="text-body-strong text-primary hover:underline">
                          {r.voucher.voucher_number}
                        </Link>
                      </td>
                      <td className="text-body px-3 py-3">
                        {r.voucher.payee_name ?? 'No payee'}
                        <span className="text-muted-foreground"> · {r.department ?? 'No department'}</span>
                      </td>
                      <td className="text-body-strong px-3 py-3 text-right tabular-nums">{formatMoney(r.voucher.amount)}</td>
                      <td className="px-3 py-3">
                        <Pill tone={tone}>{label}</Pill>
                      </td>
                      <td className="text-body px-4 py-3">
                        {r.overrode_flag && <span className="text-badge text-warning">⚠ Approved while flagged · </span>}
                        {r.remarks ? r.remarks : <span className="text-muted-foreground">No remarks</span>}
                        {extra.length > 0 && <p className="text-caption mt-0.5">{extra.join(' · ')}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {status !== 'error' && meta && meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
            <p className="text-caption">
              Showing {meta.from}–{meta.to} of {plural(meta.total, 'decision', 'decisions')}
            </p>
            {meta.last_page > 1 && (
              <Pager page={meta.current_page} last={meta.last_page} onPage={(p) => setParam({ page: p > 1 ? p : null })} />
            )}
          </div>
        )}
      </section>
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

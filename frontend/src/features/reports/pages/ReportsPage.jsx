import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarClock, ChevronDown, FileBarChart, Plus, Search, Sparkles } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listReports } from '../api'
import GenerateReportModal from '../components/GenerateReportModal'
import SchedulesDialog from '../components/SchedulesDialog'
import { changeText, reportPath, SUMMARY_STATUS, TYPE_LABEL } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const selectClass = 'text-body h-[38px] appearance-none rounded-lg border bg-card pr-8 pl-3 outline-none focus:border-primary'

/**
 * FINANCIAL REPORTS (/officer/reports; Framer ARxG8Aa6F + the ZoAX4DKjk Generate dialog), 2026-11-27.
 * 3 cards (reports this year, last month's spend, next automatic report), filters (search, type, department) and
 * page in the address (?q=&type=&department=&page=&generate=1). Rows open the report. Refreshes every 10 s while a
 * summary is being written.
 * Code differs from the frame: the AI footnote names the model actually set (or says it isn't set up); "Department"
 * type = a custom date range for one department; Schedules is read-only (one automatic monthly report).
 */
export default function ReportsPage() {
  usePageTitle('Financial reports')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const type = params.get('type') ?? ''
  const department = params.get('department') ?? ''
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounce(search.trim(), 350)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [schedules, setSchedules] = useState(false)
  const key = `${companyId}|${type}|${department}|${q}|${page}|${attempt}`

  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v == null || v === '' ? p.delete(k) : p.set(k, v)))
        return p
      },
      { replace: true },
    )
  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParam({ q, page: null })
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctrl = new AbortController()
    let timer
    const load = (quiet) =>
      listReports({ type, department, search: q, page, signal: ctrl.signal })
        .then((data) => {
          setState({ key, status: 'success', data, error: null })
          if (data.reports.some((r) => ['queued', 'writing'].includes(r.summary_status)))
            timer = window.setTimeout(() => load(true), 10_000)
        })
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [key, type, department, q, page])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const filtered = Boolean(type || department || q)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Financial reports</h1>
          <p className="text-body text-muted-foreground">Generated reports with AI narrative summaries{d ? ` · ${d.meta.company}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => setSchedules(true)} disabled={!d} className={outlineBtn}>
            <CalendarClock className="size-4" aria-hidden="true" /> Schedules
          </button>
          <button type="button" onClick={() => setParam({ generate: '1' })} disabled={!d} className={primaryBtn}>
            <Plus className="size-4" aria-hidden="true" /> Generate report
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the reports"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}
      {status === 'loading' && !d && <Skeleton />}

      {d && <Cards stats={d.meta.stats} />}

      {d && (
        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="all-reports">
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3">
            <h2 id="all-reports" className="text-card-title">
              All reports
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reports…"
                  aria-label="Search reports"
                  className="text-body h-[38px] w-[220px] rounded-lg border bg-card pr-3 pl-8 outline-none focus:border-primary"
                />
              </div>
              <Picker label="Type" value={type} onChange={(v) => setParam({ type: v, page: null })}>
                <option value="">Type: All</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="custom">Department</option>
              </Picker>
              <Picker label="Department" value={department} onChange={(v) => setParam({ department: v, page: null })}>
                <option value="">Department: All</option>
                <option value="all">Company-wide only</option>
                {d.meta.departments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Picker>
            </div>
          </div>

          {d.reports.length === 0 ? (
            <div className="border-t">
              {filtered ? (
                <EmptyState
                  icon={Search}
                  title="No reports match"
                  description="Try another search, type or department."
                  action={
                    <button
                      type="button"
                      onClick={() => (setSearch(''), setParam({ type: null, department: null, q: null, page: null }))}
                      className={outlineBtn}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={FileBarChart}
                  title="No reports yet"
                  description={`Generate the first one, or wait for the automatic monthly report on ${formatDate(d.meta.stats.next_scheduled.date, 'MMM d')}.`}
                  action={
                    <button type="button" onClick={() => setParam({ generate: '1' })} className={primaryBtn}>
                      <Plus className="size-4" aria-hidden="true" /> Generate report
                    </button>
                  }
                />
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead className="border-y bg-muted">
                  <tr className="text-table-head text-muted-foreground">
                    <th className="px-4 py-2.5 font-semibold">Report</th>
                    <th className="w-[110px] px-3 py-2.5 font-semibold">Type</th>
                    <th className="w-[150px] px-3 py-2.5 font-semibold">Department</th>
                    <th className="w-[90px] px-3 py-2.5 text-right font-semibold">Vouchers</th>
                    <th className="w-[140px] px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="w-[150px] px-3 py-2.5 font-semibold">AI summary</th>
                    <th className="w-[80px] px-4 py-2.5">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.reports.map((r) => {
                    const s = SUMMARY_STATUS[r.summary_status] ?? SUMMARY_STATUS.off
                    return (
                      <tr
                        key={r.id}
                        onClick={() => navigate(reportPath(r.id))}
                        className="cursor-pointer border-b last:border-b-0 hover:bg-muted/60"
                      >
                        <td className="px-4 py-3">
                          <p className="text-body-strong">{r.title}</p>
                          <p className="text-caption">
                            {formatDate(r.period_start, 'MMM d')} – {formatDate(r.period_end, 'MMM d')} · generated{' '}
                            {formatDate(r.generated_at, 'MMM d')}
                            {r.generated_by ? ` · ${r.generated_by}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <Pill tone="neutral">{TYPE_LABEL[r.type]}</Pill>
                        </td>
                        <td className="text-body px-3 py-3">{r.department?.name ?? 'All'}</td>
                        <td className="text-body px-3 py-3 text-right tabular-nums">{formatNumber(r.vouchers)}</td>
                        <td className="text-body-strong px-3 py-3 text-right tabular-nums">{formatMoney(r.total)}</td>
                        <td className="px-3 py-3">
                          <Pill tone={s.tone} className={r.summary_status === 'failed' ? 'border border-danger' : undefined}>
                            {s.label}
                          </Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={reportPath(r.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-auth-link text-primary hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {d.meta.last_page > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
              <p className="text-caption">
                Showing {d.reports.length} of {d.meta.total} reports
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setParam({ page: page - 1 })}
                  className={cn(outlineBtn, 'h-8 px-3')}
                >
                  ‹ Prev
                </button>
                <span className="text-caption px-1.5">
                  Page {page} of {d.meta.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= d.meta.last_page}
                  onClick={() => setParam({ page: page + 1 })}
                  className={cn(outlineBtn, 'h-8 px-3')}
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {d && (
        <p className="text-caption flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-faint px-4 py-3">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          {d.meta.ai.configured
            ? `Summaries are written by ${d.meta.ai.model} from approved-voucher totals only (no names or descriptions are sent). Always check the figures before sharing a report.`
            : 'AI summaries aren’t set up yet (no OpenAI key on the server). Reports still have all their figures; the summary can be added later with “Write summary”.'}
          {d.meta.ai.paused ? ' This month’s OpenAI spend cap is reached, so new summaries are paused.' : ''}
        </p>
      )}

      <AnimatePresence>
        {d && params.get('generate') === '1' && (
          <GenerateReportModal
            key="generate"
            departments={d.meta.departments}
            ai={d.meta.ai}
            onClose={() => setParam({ generate: null })}
            onCreated={(report) => navigate(reportPath(report.id))}
          />
        )}
        {d && schedules && (
          <SchedulesDialog key="schedules" next={d.meta.stats.next_scheduled} ai={d.meta.ai} onClose={() => setSchedules(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function Cards({ stats }) {
  const y = stats.this_year
  const lm = stats.last_month
  const change = changeText(lm.change_pct)
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
        <span className="text-caption">Reports this year</span>
        <span className="text-stat-value tabular-nums">{y.total}</span>
        <span className="text-caption">
          {y.monthly} monthly · {y.quarterly} quarterly · {y.custom} department
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
        <span className="text-caption">{lm.label} total spend</span>
        <span className="text-stat-value tabular-nums">{formatMoney(lm.spend)}</span>
        <span className={cn('text-badge', change ? (lm.change_pct >= 0 ? 'text-primary' : 'text-success') : 'text-muted-foreground')}>
          {change ? `${change} vs ${lm.previous_label}` : `Nothing approved in ${lm.previous_label} to compare`}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
        <span className="text-caption">Next scheduled</span>
        <span className="text-stat-value">{formatDate(stats.next_scheduled.date, 'MMM d')}</span>
        <span className="text-caption">{stats.next_scheduled.label} · auto</span>
      </div>
    </div>
  )
}

function Picker({ label, value, onChange, children }) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading reports" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-xl border bg-card" />
    </div>
  )
}

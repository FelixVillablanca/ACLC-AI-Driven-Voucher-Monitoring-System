import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileBarChart } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { compactMoney } from '@/features/budgets'
import { changeText, SUMMARY_STATUS } from '@/features/reports'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { listSupervisorReports } from '../api'
import Pager from '../components/Pager'
import { shortName } from '../utils'

const TYPES = [
  { key: '', label: 'All' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'custom', label: 'Department' },
]
const SIGNOFFS = [
  { key: '', label: 'Any sign-off' },
  { key: 'pending', label: 'Needs you' },
  { key: 'signed', label: 'Signed' },
  { key: 'returned', label: 'Sent back' },
]

/**
 * FINANCIAL REPORTS for the Supervisor / Manager (/supervisor/reports; Framer AaD8UZ08p), 2026-11-27. The reports
 * Accounting made (and the automatic monthly one), newest first, 10 a page, with their AI summary state and the
 * sign-off: company-wide monthly / quarterly reports wait for a Supervisor ("Needs you"). Type + sign-off filters in the
 * address (?type=&signoff=&page=). Loading / error / empty states.
 * Code differs from the frame: no "+ Generate report" (Accounting prepares reports; the subtitle says so); a sign-off filter.
 */
export default function SupervisorReportsPage() {
  usePageTitle('Financial reports')
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const type = TYPES.some((t) => t.key && t.key === params.get('type')) ? params.get('type') : ''
  const signoff = SIGNOFFS.some((t) => t.key && t.key === params.get('signoff')) ? params.get('signoff') : ''
  const page = Number(params.get('page')) || 1
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([companyId, type, signoff, page, attempt])

  useEffect(() => {
    const ctrl = new AbortController()
    listSupervisorReports({ type, signoff, page, signal: ctrl.signal })
      .then((data) => setState({ key, status: 'success', data, error: null }))
      .catch((error) => !ctrl.signal.aborted && setState({ key, status: 'error', data: null, error }))
    return () => ctrl.abort()
  }, [key, type, signoff, page])

  const status = state.key === key ? state.status : 'loading'
  const d = status === 'success' ? state.data : null
  const st = d?.meta.stats
  const setParam = (changes) =>
    setParams(
      (p) => {
        Object.entries(changes).forEach(([k, v]) => (v ? p.set(k, String(v)) : p.delete(k)))
        return p
      },
      { replace: true },
    )

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Financial reports</h1>
          <p className="text-body text-muted-foreground">
            Reports prepared by Accounting · with AI-written summaries{d ? ` · ${d.meta.company}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Select id="sv-rep-type" label="Type" value={type} options={TYPES} onChange={(v) => setParam({ type: v, page: null })} />
          <Select
            id="sv-rep-signoff"
            label="Sign-off"
            value={signoff}
            options={SIGNOFFS}
            onChange={(v) => setParam({ signoff: v, page: null })}
          />
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card
          label={st ? `${st.last_month.label} spend` : 'Last month’s spend'}
          value={st ? compactMoney(st.last_month.spend) : '—'}
          title={st ? formatMoney(st.last_month.spend) : undefined}
          caption={
            st
              ? st.last_month.change_pct == null
                ? `No spending in ${st.last_month.previous_label} to compare`
                : `${changeText(st.last_month.change_pct)} vs ${st.last_month.previous_label}`
              : ' '
          }
        />
        <Card
          label="Reports to sign off"
          value={st ? st.to_sign.count : '—'}
          tone={st?.to_sign.count ? 'warning' : undefined}
          caption={st ? (st.to_sign.count ? st.to_sign.titles.map(shortTitle).join(' · ') : 'Nothing waiting for you') : ' '}
          onClick={st?.to_sign.count ? () => setParam({ signoff: 'pending', type: null, page: null }) : undefined}
        />
        <Card
          label="Next automatic report"
          value={st ? formatDate(st.next_scheduled.date, 'MMM d') : '—'}
          caption={st ? `${st.next_scheduled.label} · made on the 1st` : ' '}
        />
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {status === 'loading' && <div role="status" aria-label="Loading reports" className="h-[360px] animate-pulse bg-muted/40" />}
        {status === 'error' && (
          <ErrorState
            title="Couldn't load reports"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
        {d && d.reports.length === 0 && (
          <EmptyState
            icon={FileBarChart}
            title={type || signoff ? 'No reports match these filters' : 'No reports yet'}
            description={
              type || signoff
                ? 'Try another type or sign-off filter.'
                : `Accounting makes reports, and a monthly one is made automatically on the 1st (next: ${st ? formatDate(st.next_scheduled.date, 'MMM d') : 'the 1st'}).`
            }
            action={
              type || signoff ? (
                <button
                  type="button"
                  onClick={() => setParam({ type: null, signoff: null, page: null })}
                  className="text-auth-link text-primary hover:underline"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        )}
        {d && d.reports.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="border-b bg-muted">
                <tr className="text-table-head text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Report</th>
                  <th className="w-[140px] px-3 py-2.5 font-semibold">Prepared by</th>
                  <th className="w-[150px] px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="w-[150px] px-3 py-2.5 font-semibold">AI summary</th>
                  <th className="w-[150px] px-4 py-2.5 font-semibold">Sign-off</th>
                </tr>
              </thead>
              <tbody>
                {d.reports.map((r) => {
                  const sum = SUMMARY_STATUS[r.summary_status] ?? { tone: 'neutral', label: r.summary_status }
                  return (
                    <tr
                      key={r.id}
                      className={cn('border-b last:border-b-0 hover:bg-muted', r.signoff.status === 'pending' && 'bg-warning-soft/40')}
                    >
                      <td className="px-4 py-3">
                        <Link to={`${PATHS.SUPERVISOR_REPORTS}/${r.id}`} className="text-body-strong hover:text-primary hover:underline">
                          {r.title}
                        </Link>
                        <span className="text-caption block">
                          {r.department ? r.department.name : 'All departments'} · {formatDate(r.generated_at, 'MMM d')}
                        </span>
                      </td>
                      <td className="text-body px-3 py-3">{r.is_scheduled ? 'Automatic' : shortName(r.generated_by)}</td>
                      <td className="text-body-strong px-3 py-3 text-right tabular-nums">{formatMoney(r.total)}</td>
                      <td className="px-3 py-3">
                        <Pill tone={sum.tone}>{sum.label}</Pill>
                      </td>
                      <td className="px-4 py-3">
                        <SignoffCell s={r.signoff} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {d && d.meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5">
            <p className="text-caption">
              Showing {d.meta.from}–{d.meta.to} of {plural(d.meta.total, 'report', 'reports')}
            </p>
            {d.meta.last_page > 1 && (
              <Pager page={d.meta.current_page} last={d.meta.last_page} onPage={(p) => setParam({ page: p > 1 ? p : null })} />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/** "October 2026 · Monthly expense report" → "October 2026" */
const shortTitle = (t) => String(t).split(' · ')[0]

function SignoffCell({ s }) {
  if (s.status === 'pending') return <Pill tone="warning">Needs you</Pill>
  if (s.status === 'signed') return <span className="text-badge text-success">✓ Signed {formatDate(s.at, 'MMM d')}</span>
  if (s.status === 'returned') return <span className="text-badge text-danger">↩ Sent back {formatDate(s.at, 'MMM d')}</span>
  return <span className="text-caption">—</span>
}

function Card({ label, value, caption, tone, title, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-card px-[18px] py-4 text-left',
        onClick && 'outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'warning' && 'text-warning')} title={title}>
        {value}
      </span>
      <span className="text-caption">{caption}</span>
    </Tag>
  )
}

function Select({ id, label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-caption">
        {label}:
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value || null)} className={cn(inputClass, 'h-[38px] w-auto pr-8')}>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

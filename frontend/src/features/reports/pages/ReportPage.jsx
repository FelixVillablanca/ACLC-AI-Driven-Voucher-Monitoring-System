import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileSpreadsheet, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { reviewPath } from '@/features/approvals'
import { compactMoney } from '@/features/budgets'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadReport, getReport, rewriteSummary } from '../api'
import { changeText } from '../utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const outlineBtn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
const primaryBtn =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

const FINDING = { open: 'Still open', valid_high: 'Valid but high', needs_changes: 'Needs changes', false_alarm: 'False alarm' }

/**
 * ONE FINANCIAL REPORT (/officer/reports/:id; Framer UmSNc_71u), 2026-11-27. The figures were frozen when it was
 * made; the AI summary is written in the background and this page checks every 4 s until it's there.
 * Downloads: Excel + PDF (each one is in the audit log). Summary states: writing, ready (Regenerate), failed (Retry),
 * paused at the spend cap, not set up (no OpenAI key), not asked for (Write summary).
 * Code differs from the frame: "Flagged" (the automatic check), not "AI-flagged"; the flagged list / forecast
 * sections appear only when they were included.
 */
export default function ReportPage() {
  const { id } = useParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(null) // 'summary' | 'pdf' | 'xlsx'
  const key = `${companyId}|${id}|${attempt}`

  useEffect(() => {
    const ctrl = new AbortController()
    let timer
    const load = (quiet) =>
      getReport(id, { background: quiet, signal: ctrl.signal })
        .then((data) => {
          setState({ key, status: 'success', data, error: null })
          if (['queued', 'writing'].includes(data.summary_status)) timer = window.setTimeout(() => load(true), 4000)
        })
        .catch((error) => !ctrl.signal.aborted && !quiet && setState({ key, status: 'error', data: null, error }))
    load(false)
    return () => {
      ctrl.abort()
      window.clearTimeout(timer)
    }
  }, [key, id])

  const status = state.key === key ? state.status : 'loading'
  const r = status === 'success' ? state.data : null
  usePageTitle(r?.title ?? 'Financial report')

  const summary = async () => {
    setBusy('summary')
    try {
      await rewriteSummary(id)
      toast.success('Writing the summary. It appears here in about 20 seconds.')
      setAttempt((n) => n + 1)
    } catch (error) {
      toast.error(error.message)
      if (error.code === 'SUMMARY_IN_PROGRESS') setAttempt((n) => n + 1)
    } finally {
      setBusy(null)
    }
  }
  const download = async (format) => {
    setBusy(format)
    try {
      toast.success(`Downloaded ${await downloadReport(id, format)}`)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(null)
    }
  }

  if (status === 'error') {
    const missing = state.error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
        <BackLink />
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={missing ? 'Report not found' : "Couldn't load this report"}
            message={missing ? 'It isn’t a report of the company you’re working in.' : state.error.message}
            requestId={missing ? undefined : state.error.requestId}
            onRetry={missing ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      </div>
    )
  }

  const f = r?.figures

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">{r?.title ?? 'Financial report'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink inline />
            {r && (
              <span>
                / {r.department?.name ?? 'All departments'} · {formatDate(r.period_start, 'MMM d')} –{' '}
                {formatDate(r.period_end, 'MMM d, yyyy')} · generated {formatDate(r.generated_at, 'MMM d, yyyy')}
                {r.generated_by ? (r.is_scheduled ? ' automatically' : ` by ${r.generated_by}`) : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={!r || busy} onClick={() => download('xlsx')} className={outlineBtn}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> {busy === 'xlsx' ? 'Preparing…' : 'Excel'}
          </button>
          <button type="button" disabled={!r || busy} onClick={() => download('pdf')} className={primaryBtn}>
            <Download className="size-4" aria-hidden="true" /> {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {status === 'loading' && <Skeleton />}

      {r && f && (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Total spend" value={formatMoney(f.total_spend)}>
              {f.change_pct != null ? (
                <span className={cn('text-badge', f.change_pct >= 0 ? 'text-primary' : 'text-success')}>
                  {changeText(f.change_pct)} vs {f.period.previous_label}
                </span>
              ) : (
                `Nothing approved in ${f.period.previous_label}`
              )}
            </Card>
            <Card label="Vouchers approved" value={formatNumber(f.approved)}>
              {f.rejected} rejected · {f.returned} returned
            </Card>
            <Card label="Flagged" value={formatNumber(f.flagged)} tone={f.flagged_open ? 'warning' : undefined}>
              {f.flagged_open ? `${f.flagged_open} still unresolved` : f.flagged ? 'All reviewed' : 'Nothing flagged'}
            </Card>
            <Card label={`Budget used (${f.budget?.label ?? 'FY'})`} value={f.budget ? `${f.budget.used_pct}%` : '—'}>
              {f.budget ? `${compactMoney(f.budget.used)} of ${compactMoney(f.budget.total)}` : 'No budget set'}
            </Card>
          </div>

          <SummaryCard r={r} busy={busy === 'summary'} onWrite={summary} />

          {(f.departments?.length > 0 || f.categories?.length > 0) && (
            <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
              {f.departments?.length > 0 && <Departments rows={f.departments} />}
              {f.categories?.length > 0 && <Categories rows={f.categories} previous={f.period.previous_label} />}
            </div>
          )}

          {f.flagged_list && <FlaggedList rows={f.flagged_list} />}

          {r.includes?.forecast && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-card-title">Forecast</h2>
              <p className="text-body mt-1">
                {f.forecast
                  ? `${f.forecast.month}: ${formatMoney(f.forecast.predicted)} expected (likely ${formatMoney(f.forecast.lower)} – ${formatMoney(f.forecast.upper)}), from the trend of approved spending.`
                  : 'No forecast for the month after this period (not enough history, or it was made before forecasts existed).'}
              </p>
            </section>
          )}

          <p className="text-caption">
            Spend = vouchers with their final approval in the period. Figures were frozen when this report was generated.
          </p>
        </>
      )}
    </div>
  )
}

function BackLink({ inline }) {
  return (
    <Link
      to={PATHS.OFFICER_REPORTS}
      className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Financial reports
    </Link>
  )
}

function Card({ label, value, tone, children }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-4 py-3.5',
        tone === 'warning' ? 'border-warning/40 bg-warning-soft' : 'bg-card',
      )}
    >
      <span className="text-caption">{label}</span>
      <span className="text-stat-value tabular-nums">{value}</span>
      <span className="text-caption">{children}</span>
    </div>
  )
}

const CHIP = { danger: 'danger', warning: 'warning', success: 'success', neutral: 'neutral' }

function SummaryCard({ r, busy, onWrite }) {
  const s = r.summary_status
  const canWrite = r.ai?.configured && !r.ai?.paused
  const writeBtn = (label) => (
    <button
      type="button"
      onClick={onWrite}
      disabled={busy || !canWrite}
      className="text-auth-link inline-flex items-center gap-1 text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} aria-hidden="true" /> {label}
    </button>
  )
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary-faint p-5"
      aria-labelledby="ai-summary"
      aria-busy={['queued', 'writing'].includes(s)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-summary" className="text-card-title flex items-center gap-1.5 text-primary">
          <Sparkles className="size-4" aria-hidden="true" /> AI summary
        </h2>
        <span className="text-caption flex items-center gap-2">
          {s === 'ready' && (
            <>
              {r.summary_model} · {writeBtn('Regenerate')}
            </>
          )}
          {s === 'failed' && writeBtn('Retry')}
          {s === 'off' && writeBtn('Write summary')}
        </span>
      </div>

      {['queued', 'writing'].includes(s) && (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-caption">⟳ Writing the summary… it appears here by itself.</p>
          {[100, 92, 70].map((w) => (
            <div key={w} className="h-3 animate-pulse rounded bg-primary-soft" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {s === 'ready' && (
        <>
          <div className="flex flex-col gap-2">
            {r.summary.map((p, i) => (
              <p key={i} className="text-body leading-relaxed">
                {p}
              </p>
            ))}
          </div>
          {r.highlights?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.highlights.map((h) => (
                <Pill key={h.text} tone={CHIP[h.tone] ?? 'neutral'}>
                  {h.text}
                </Pill>
              ))}
            </div>
          )}
          <p className="text-caption">AI-generated from approved-voucher totals only · check the figures before sharing</p>
        </>
      )}

      {s === 'failed' && (
        <p className="text-body flex gap-2 text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>The summary couldn’t be written{r.summary_error ? `: ${r.summary_error}` : '.'} The figures below are complete.</span>
        </p>
      )}
      {s === 'paused' && (
        <p className="text-body text-warning">
          Paused: this month’s OpenAI spend cap (set by the Super Admin) is reached. The figures below are complete.
        </p>
      )}
      {s === 'not_set_up' && (
        <p className="text-body text-muted-foreground">
          AI summaries aren’t set up yet (no OpenAI key on the server). The figures below are complete; a summary can be written once it’s
          set up.
          {r.ai?.configured ? <> {writeBtn('Write summary now')}</> : null}
        </p>
      )}
      {s === 'off' && <p className="text-body text-muted-foreground">No AI summary was asked for when this report was made.</p>}
    </section>
  )
}

function Departments({ rows }) {
  const max = Math.max(1, ...rows.map((x) => Number(x.amount)))
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="by-dept">
      <h2 id="by-dept" className="text-card-title">
        Spend by department
      </h2>
      {rows.map((x) => (
        <div key={x.name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body truncate">{x.name}</span>
            <span className="text-body-strong tabular-nums">{formatMoney(x.amount)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(x.amount) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </section>
  )
}

function Categories({ rows, previous }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card" aria-label="Top categories">
      <table className="w-full text-left">
        <thead className="border-b bg-muted">
          <tr className="text-table-head text-muted-foreground">
            <th className="px-4 py-2.5 font-semibold">Top categories</th>
            <th className="px-3 py-2.5 text-right font-semibold">Vouchers</th>
            <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
            <th className="px-4 py-2.5 text-right font-semibold">vs {previous}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name} className="border-b last:border-b-0">
              <td className="text-body px-4 py-2.5">{c.name}</td>
              <td className="text-body px-3 py-2.5 text-right tabular-nums">{c.vouchers}</td>
              <td className="text-body-strong px-3 py-2.5 text-right tabular-nums">{formatMoney(c.amount)}</td>
              <td
                className={cn(
                  'text-badge px-4 py-2.5 text-right',
                  c.change_pct == null ? 'text-muted-foreground' : c.change_pct >= 0 ? 'text-primary' : 'text-success',
                )}
              >
                {changeText(c.change_pct) ?? 'new'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function FlaggedList({ rows }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="flagged-list">
      <h2 id="flagged-list" className="text-card-title px-4 pt-3.5 pb-3">
        Flagged vouchers
      </h2>
      {rows.length === 0 ? (
        <p className="text-caption border-t px-4 py-4">The automatic check flagged nothing in this period.</p>
      ) : (
        <table className="w-full text-left">
          <thead className="border-y bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Voucher</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Finding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b last:border-b-0">
                <td className="px-4 py-2.5">
                  <Link to={reviewPath(v.id)} className="text-body-strong text-primary hover:underline">
                    {v.voucher_number}
                  </Link>
                </td>
                <td className="text-body px-3 py-2.5 text-right tabular-nums">{formatMoney(v.amount)}</td>
                <td className="text-body px-3 py-2.5 capitalize">{v.status.replace('_', ' ')}</td>
                <td className="px-4 py-2.5">
                  <Pill tone={v.finding === 'open' ? 'warning' : v.finding === 'false_alarm' ? 'success' : 'neutral'}>
                    {FINDING[v.finding] ?? '—'}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the report" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[96px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-[180px] animate-pulse rounded-xl border bg-card" />
      <div className="h-[220px] animate-pulse rounded-xl border bg-card" />
    </div>
  )
}

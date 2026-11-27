import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Download, Loader2, Sparkles, TriangleAlert, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { changeText, SIGNOFF_STATUS } from '@/features/reports'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadSupervisorReportPdf, getSupervisorReport, sendReportBack, signOffReport } from '../api'
import { outlineBtn, primaryBtn } from '../utils'

/**
 * ONE FINANCIAL REPORT + MANAGER SIGN-OFF (/supervisor/reports/:id; Framer dcfDyyuKE), 2026-11-27.
 * Cards (total spend vs the previous period, vouchers approved + rejected / returned, flagged + still open), the AI
 * summary (read-only; refreshes by itself while it's being written), spend by department, and the sign-off card:
 *   ✓ Totals match the approved vouchers  worked out by the server NOW (warning if vouchers were approved since)
 *   ☐ AI summary reviewed                 required when the summary is ready
 *   ☐ Open flags noted for the board      required when flagged vouchers were still open
 *   Comments for the board (optional) → Sign off report; Send back to Accounting needs a note.
 * Signed / sent back / not needed reports show who and when instead. 409 (someone decided first) reloads.
 * Code differs from the frame: the totals check is real (can fail); the AI summary can't be regenerated here (Accounting's).
 */
export default function SupervisorReportPage() {
  const { id } = useParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', r: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${companyId}|${id}|${attempt}`

  useEffect(() => {
    let alive = true
    let timer
    const load = (quiet) =>
      getSupervisorReport(id, { background: quiet })
        .then((r) => {
          if (!alive) return
          setState({ key, status: 'success', r, error: null })
          if (['queued', 'writing'].includes(r.summary_status)) timer = window.setTimeout(() => load(true), 4000)
        })
        .catch((error) => alive && !quiet && setState({ key, status: 'error', r: null, error }))
    load(false)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [key, id])

  const status = state.key === key ? state.status : 'loading'
  const r = status === 'success' ? state.r : null
  const f = r?.figures ?? {}
  usePageTitle(r?.title ?? 'Financial report')

  const [pdfBusy, setPdfBusy] = useState(false)
  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadSupervisorReportPdf(r.id)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPdfBusy(false)
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

  const so = r?.signoff
  const preparedBy = r ? (r.is_scheduled ? 'Made automatically' : `Prepared by ${r.generated_by ?? 'Accounting'}`) : ''

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">{r?.title ?? 'Financial report'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink inline />
            {r && (
              <span>
                / {preparedBy} · {formatDate(r.generated_at, 'MMM d')}
                {so.status === 'pending' ? ' · waiting for your sign-off' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {r && so.status !== 'pending' && <Pill tone={SIGNOFF_STATUS[so.status]?.tone}>{SIGNOFF_STATUS[so.status]?.label}</Pill>}
          <button type="button" onClick={pdf} disabled={!r || pdfBusy} className={outlineBtn}>
            {pdfBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            Download PDF
          </button>
          {so?.status === 'pending' && (
            <a href="#signoff" className={primaryBtn}>
              <Check className="size-4" aria-hidden="true" /> Sign off report
            </a>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading the report" className="flex flex-col gap-3.5">
          <div className="grid gap-3.5 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[100px] animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
          <div className="flex flex-col gap-3.5 lg:flex-row">
            <div className="h-[260px] flex-1 animate-pulse rounded-xl border bg-card" />
            <div className="h-[340px] animate-pulse rounded-xl border bg-card lg:w-[340px]" />
          </div>
        </div>
      )}

      {r && (
        <>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Card
              label="Total spend"
              value={formatMoney(f.total_spend ?? r.total)}
              caption={
                f.change_pct == null
                  ? `Nothing in ${f.period?.previous_label ?? 'the previous period'} to compare`
                  : `${changeText(f.change_pct)} vs ${f.period?.previous_label}`
              }
            />
            <Card
              label="Vouchers approved"
              value={f.approved ?? r.vouchers}
              caption={`${f.rejected ?? 0} rejected · ${f.returned ?? 0} returned`}
            />
            <Card
              label="Flagged"
              value={f.flagged ?? 0}
              caption={f.flagged_open ? `${f.flagged_open} still open when the report was made` : 'None still open'}
              tone={f.flagged_open ? 'warning' : undefined}
            />
          </div>

          <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
              <Summary r={r} />
              {f.departments?.length > 0 && <Departments rows={f.departments} />}
            </div>
            <div id="signoff" className="w-full scroll-mt-6 lg:w-[340px] lg:shrink-0">
              <SignoffCard r={r} onChanged={() => setAttempt((n) => n + 1)} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BackLink({ inline }) {
  return (
    <Link
      to={PATHS.SUPERVISOR_REPORTS}
      className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Financial reports
    </Link>
  )
}

function Card({ label, value, caption, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
      <span className="text-caption">{label}</span>
      <span className={cn('text-stat-value tabular-nums', tone === 'warning' && 'text-warning')}>{value}</span>
      <span className="text-caption">{caption}</span>
    </div>
  )
}

/** The AI summary, read-only (Accounting regenerates it). */
function Summary({ r }) {
  const s = r.summary_status
  return (
    <section
      className="flex flex-col gap-2.5 rounded-xl border border-primary/40 bg-primary-faint p-[18px]"
      aria-labelledby="sv-ai-summary"
      aria-busy={['queued', 'writing'].includes(s)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="sv-ai-summary" className="text-card-title flex items-center gap-1.5">
          <Sparkles className="size-4 text-primary" aria-hidden="true" /> AI summary
        </h2>
        {s === 'ready' && r.summary_model && <Pill tone="primary">{r.summary_model}</Pill>}
      </div>
      {s === 'ready' && (
        <>
          {r.summary.map((p, i) => (
            <p key={i} className="text-body leading-relaxed">
              {p}
            </p>
          ))}
          <p className="text-caption">AI-generated from approved-voucher totals · check the figures before signing</p>
        </>
      )}
      {['queued', 'writing'].includes(s) && (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-caption">⟳ Writing the summary… it appears here by itself.</p>
          {[100, 92, 70].map((w) => (
            <div key={w} className="h-3 animate-pulse rounded bg-primary-soft" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {s === 'failed' && (
        <p className="text-body text-danger">The summary couldn’t be written. The figures are complete; Accounting can try again.</p>
      )}
      {s === 'paused' && (
        <p className="text-body text-warning">Paused: this month’s OpenAI spend cap is reached. The figures are complete.</p>
      )}
      {s === 'not_set_up' && (
        <p className="text-body text-muted-foreground">
          AI summaries aren’t set up yet (no OpenAI key on the server). The figures are complete.
        </p>
      )}
      {s === 'off' && <p className="text-body text-muted-foreground">No AI summary was asked for when this report was made.</p>}
    </section>
  )
}

function Departments({ rows }) {
  const max = Math.max(1, ...rows.map((x) => Number(x.amount)))
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="sv-rep-dept">
      <h2 id="sv-rep-dept" className="text-card-title">
        Spend by department
      </h2>
      {rows.map((x) => (
        <div key={x.name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body truncate">{x.name}</span>
            <span className="text-body-strong tabular-nums">
              {formatMoney(x.amount)}
              {x.change_pct != null && <span className="text-caption font-normal"> · {changeText(x.change_pct)}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(x.amount) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </section>
  )
}

function SignoffCard({ r, onChanged }) {
  const so = r.signoff
  const c = r.checks
  const [summaryReviewed, setSummaryReviewed] = useState(false)
  const [flagsNoted, setFlagsNoted] = useState(false)
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState('sign') // 'sign' | 'back'
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  if (so.status !== 'pending') {
    return (
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-labelledby="sv-signoff">
        <h2 id="sv-signoff" className="text-card-title">
          Manager sign-off
        </h2>
        {so.status === 'signed' && (
          <>
            <p className="text-body flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-4" aria-hidden="true" /> Signed off by {so.by ?? 'a Supervisor'} ·{' '}
              {formatDate(so.at, 'MMM d, yyyy · h:mm a')}
            </p>
            {so.comment && <p className="text-body">“{so.comment}”</p>}
            {so.checks && so.checks.totals_match === false && (
              <p className="text-caption text-warning">Signed while the totals didn’t match the approved vouchers.</p>
            )}
          </>
        )}
        {so.status === 'returned' && (
          <>
            <p className="text-body flex items-center gap-1.5 text-danger">
              <Undo2 className="size-4" aria-hidden="true" /> Sent back by {so.by ?? 'a Supervisor'} · {formatDate(so.at, 'MMM d, yyyy')}
            </p>
            {so.returned_note && <p className="text-body">“{so.returned_note}”</p>}
            <p className="text-caption">Accounting makes a new report once it’s fixed; it will wait for sign-off again.</p>
          </>
        )}
        {so.status === 'not_needed' && (
          <p className="text-caption">Only company-wide monthly and quarterly reports need a sign-off. This one is for reading only.</p>
        )}
      </section>
    )
  }

  const run = async (fn, message) => {
    setBusy(true)
    setErrors({})
    try {
      await fn()
      toast.success(message)
      onChanged()
    } catch (e) {
      if (e.code === 'REPORT_NOT_WAITING') {
        toast.error(e.message)
        onChanged()
      } else if (e.errors) setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else toast.error(e.message)
      setBusy(false)
    }
  }
  const sign = () => {
    const missing = {}
    if (c.needs_summary_review && !summaryReviewed) missing['checks.summary_reviewed'] = 'Read the AI summary and tick this first.'
    if (c.needs_flags_noted && !flagsNoted)
      missing['checks.flags_noted'] = 'Some flagged vouchers were still open: tick this to confirm you noted them.'
    if (Object.keys(missing).length) return setErrors(missing)
    run(
      () => signOffReport(r.id, { summary_reviewed: summaryReviewed, flags_noted: flagsNoted }, comment.trim()),
      'Report signed off. Accounting was told.',
    )
  }
  const back = () => {
    if (note.trim().length < 3) return setErrors({ note: 'Tell Accounting what to fix.' })
    run(() => sendReportBack(r.id, note.trim()), 'Report sent back to Accounting.')
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="sv-signoff">
      <h2 id="sv-signoff" className="text-card-title">
        Manager sign-off
      </h2>
      {mode === 'sign' ? (
        <>
          <ul className="flex flex-col gap-2.5">
            <li className="text-body flex items-start gap-2">
              {c.totals_match ? (
                <>
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Totals match the approved vouchers
                </>
              ) : (
                <>
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    Totals don’t match today: {c.totals_now.approved} approved vouchers, {formatMoney(c.totals_now.total)} now (the report
                    froze {r.figures?.approved ?? r.vouchers}, {formatMoney(r.figures?.total_spend ?? r.total)}). Consider sending it back.
                  </span>
                </>
              )}
            </li>
            <Tick
              id="chk-summary"
              checked={summaryReviewed}
              onChange={setSummaryReviewed}
              disabled={busy || !c.needs_summary_review}
              label={c.needs_summary_review ? 'AI summary reviewed' : 'AI summary reviewed (no summary to review)'}
              error={errors['checks.summary_reviewed']}
            />
            <Tick
              id="chk-flags"
              checked={flagsNoted}
              onChange={setFlagsNoted}
              disabled={busy || !c.needs_flags_noted}
              label={
                c.needs_flags_noted
                  ? `Open flags noted for the board (${r.figures?.flagged_open})`
                  : 'Open flags noted for the board (none open)'
              }
              error={errors['checks.flags_noted']}
            />
          </ul>
          <label htmlFor="sv-board-comment" className="sr-only">
            Comments for the board
          </label>
          <textarea
            id="sv-board-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comments for the board (optional)…"
            className={cn(inputClass, 'h-auto resize-y py-2')}
          />
          {errors.comment && <p className="text-caption text-danger">{errors.comment}</p>}
          <button type="button" onClick={sign} disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            {busy ? 'Signing…' : 'Sign off report'}
          </button>
          <button type="button" onClick={() => (setMode('back'), setErrors({}))} disabled={busy} className={outlineBtn}>
            <Undo2 className="size-4" aria-hidden="true" /> Send back to Accounting
          </button>
        </>
      ) : (
        <>
          <label htmlFor="sv-back-note" className="text-label">
            What should Accounting fix? <span className="text-danger">*</span>
          </label>
          <textarea
            id="sv-back-note"
            rows={4}
            maxLength={1000}
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={errors.note ? true : undefined}
            placeholder="e.g. Q3 is missing the Marketing refunds."
            className={cn(inputClass, 'h-auto resize-y py-2')}
          />
          {errors.note && (
            <p className="text-caption text-danger" role="alert">
              {errors.note}
            </p>
          )}
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="text-auth-button flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-danger px-4 text-white outline-none hover:bg-danger/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
            {busy ? 'Sending…' : 'Send back'}
          </button>
          <button type="button" onClick={() => (setMode('sign'), setErrors({}))} disabled={busy} className={outlineBtn}>
            Cancel
          </button>
        </>
      )}
    </section>
  )
}

function Tick({ id, checked, onChange, disabled, label, error }) {
  return (
    <li className="flex flex-col gap-0.5">
      <label htmlFor={id} className={cn('text-body flex items-start gap-2', disabled ? 'text-muted-foreground' : 'cursor-pointer')}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        {label}
      </label>
      {error && (
        <p className="text-caption pl-6 text-danger" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

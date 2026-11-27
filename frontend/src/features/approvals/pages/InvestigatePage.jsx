import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Download, Loader2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadVoucherPdf, getInvestigation, getReviewOptions, getReviewVoucher } from '../api'
import { ApproveDialog, ReturnDialog } from '../components/DecisionDialogs'
import MarkNormalDialog from '../components/MarkNormalDialog'
import { announceReviewsChanged, flagSourceText, reviewPath, supervisorNames } from '../utils'

const IMPACT = {
  high: { tone: 'danger', text: 'High' },
  medium: { tone: 'warning', text: 'Medium' },
  low: { tone: 'success', text: 'Low' },
  none: { tone: 'neutral', text: '—' },
}

const FINDING_TEXT = {
  valid_high: 'Valid but high: approved',
  needs_changes: 'Needs changes: returned to the clerk',
  false_alarm: 'False alarm: flag cleared',
}

/**
 * Investigate a flag (/officer/flagged/:id; Framer YX1IiDXMp): the department's monthly spending for this
 * category (6 months + this voucher), what drove the score, a plain summary, and your finding:
 *   Valid but high → Approve (saved as the finding) · Needs changes → Return · False alarm → flag cleared.
 * Code differs from the frame: the summary is written from the numbers (no OpenAI yet, user decision), titled
 * "Summary" without ✦; the "This" bar is this voucher's total; budget % is of this fiscal year's budget (budgets are yearly since 2026-11-27).
 */
export default function InvestigatePage() {
  const { id } = useParams()
  return <InvestigateScreen key={id} id={id} />
}

function InvestigateScreen({ id }) {
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ status: 'loading', v: null, inv: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [options, setOptions] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([getReviewVoucher(id), getInvestigation(id)])
      .then(([v, inv]) => alive && setState({ status: 'success', v, inv, error: null }))
      .catch((error) => alive && setState({ status: 'error', v: null, inv: null, error }))
    getReviewOptions()
      .then((o) => alive && setOptions(o))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id, companyId, attempt])

  const { status, v, inv } = state
  const [finding, setFinding] = useState('valid_high')
  const [dialog, setDialog] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const conflict = (e) => {
    toast.error(e.message, { duration: 7000 })
    setDialog(null)
    announceReviewsChanged()
    setAttempt((n) => n + 1)
  }
  const after = (text) => {
    setDialog(null)
    announceReviewsChanged()
    toast.success(text)
    navigate(PATHS.OFFICER_FLAGGED, { replace: true })
  }
  const pdf = async () => {
    setPdfBusy(true)
    try {
      await downloadVoucherPdf(v.id)
    } catch (e) {
      toast.error(e.message || 'Couldn’t make the PDF.')
    } finally {
      setPdfBusy(false)
    }
  }

  const open = v && inv && inv.flagged && !inv.finding && v.status === 'pending' && v.review.can_act

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-16">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the investigation…</span>
        </div>
      )}

      {status === 'error' && (
        <>
          <Link to={PATHS.OFFICER_FLAGGED} className="text-caption flex w-fit items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Flagged
          </Link>
          <div className="rounded-xl border bg-card">
            <ErrorState
              title={state.error.status === 404 ? 'Voucher not found' : "Couldn't load the investigation"}
              message={state.error.status === 404 ? 'It isn’t a submitted voucher of the company you’re working in.' : state.error.message}
              requestId={state.error.requestId}
              onRetry={state.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
            />
          </div>
        </>
      )}

      {v && inv && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-page-title">Investigate · {v.voucher_number}</h1>
              <p className="text-body text-muted-foreground">
                <Link to={PATHS.OFFICER_FLAGGED} className="inline-flex items-center gap-1 hover:text-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Flagged
                </Link>
                {'  /  '}
                {[v.payee_name, formatMoney(v.amount), inv.department, v.clerk?.name].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={pdf}
                disabled={pdfBusy}
                className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {pdfBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Voucher PDF
              </button>
              <Link
                to={reviewPath(v.id)}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Open full voucher <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <SpendChart v={v} inv={inv} />
              <Signals signals={inv.signals} />
            </div>

            <aside className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:w-[310px] lg:shrink-0">
              <h2 className="text-card-title">Summary</h2>
              <p className="text-body">
                {inv.summary ??
                  (inv.checked ? 'Nothing stands out apart from the score.' : 'The automatic check hasn’t run on this voucher yet.')}
              </p>
              <p className="text-caption">
                Written from the numbers on this page by the {flagSourceText(inv.source).toLowerCase()}, not by AI.
              </p>
              <div className="h-px bg-border" />
              {open ? (
                <>
                  <p className="text-table-head text-muted-foreground">Your finding</p>
                  <div role="radiogroup" aria-label="Your finding" className="flex flex-col gap-2">
                    <Choice
                      value="valid_high"
                      current={finding}
                      onPick={setFinding}
                      title="Valid but high"
                      caption={v.review.step2_reasons.length ? `Approve and send to ${supervisorNames(v.review.supervisors)}` : 'Approve'}
                    />
                    <Choice
                      value="needs_changes"
                      current={finding}
                      onPick={setFinding}
                      title="Needs changes"
                      caption="Return to the clerk with remarks"
                    />
                    <Choice
                      value="false_alarm"
                      current={finding}
                      onPick={setFinding}
                      title="False alarm"
                      caption="Mark as normal · helps the future AI model learn"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog(finding)}
                    className="text-auth-button flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Continue <ArrowRight className="size-4" aria-hidden="true" />
                  </button>
                  <p className="text-caption">Your finding is saved to the audit log.</p>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-body-strong flex items-center gap-1.5">
                    <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                    {inv.finding ? 'Already looked into' : v.review.own_voucher ? 'Your own voucher' : 'Nothing to decide here'}
                  </p>
                  <p className="text-body text-muted-foreground">
                    {inv.finding
                      ? FINDING_TEXT[inv.finding]
                      : v.review.own_voucher
                        ? 'You created it, so another officer must review it.'
                        : v.status !== 'pending'
                          ? 'It has already been reviewed.'
                          : 'It isn’t flagged.'}
                  </p>
                  <Link to={reviewPath(v.id)} className="text-auth-link text-primary hover:underline">
                    Open full voucher →
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      <AnimatePresence>
        {v && dialog === 'valid_high' && (
          <ApproveDialog
            key="a"
            voucher={v}
            aiFinding="valid_high"
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(r) =>
              after(
                r.forwarded
                  ? `${r.voucher_number} approved and sent to ${supervisorNames(r.supervisors)}.`
                  : `${r.voucher_number} approved.`,
              )
            }
          />
        )}
        {v && dialog === 'needs_changes' && (
          <ReturnDialog
            key="r"
            voucher={v}
            options={options}
            aiFinding="needs_changes"
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(r) => after(`${r.voucher_number} was sent back to the clerk.`)}
          />
        )}
        {v && dialog === 'false_alarm' && (
          <MarkNormalDialog
            key="n"
            voucher={v}
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(r) => after(`${r.voucher_number} was marked as normal. It stays in the review queue.`)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** 6 months of the department's approved spending in this category + this voucher (Framer bar strip). */
function SpendChart({ v, inv }) {
  const bars = [
    ...inv.history.map((m) => ({ label: m.label, value: Number(m.total), mine: false })),
    { label: 'This', value: Number(v.amount), mine: true },
  ]
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] py-4" aria-label="Spending history">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-px">
          <h2 className="text-card-title">
            {inv.category ?? 'This category'} spend · {inv.department ?? 'no department'}
          </h2>
          <p className="text-caption">
            {inv.average
              ? `Monthly totals (approved) · 6-month average ${formatMoney(inv.average)}`
              : `Monthly totals (approved) · not enough history yet (${inv.months_with_spending} of 6 months with spending)`}
          </p>
        </div>
        {inv.score && (
          <span className="text-badge rounded-full bg-danger px-2.5 py-1 text-white">Score {Number(inv.score).toFixed(2)}</span>
        )}
      </div>
      <div
        className="flex h-[150px] items-end gap-2.5 rounded-lg bg-muted px-2 pt-3"
        role="img"
        aria-label="Monthly totals and this voucher"
      >
        {bars.map((b) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className={cn('text-caption tabular-nums', b.mine && 'text-badge text-danger')}>{shortMoney(b.value)}</span>
            <div
              className={cn('w-full rounded-t-md', b.mine ? 'bg-danger' : 'bg-primary-soft')}
              style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2.5 px-2">
        {bars.map((b) => (
          <span key={b.label} className={cn('text-caption flex-1 text-center', b.mine && 'text-badge text-danger')}>
            {b.label}
          </span>
        ))}
      </div>
    </section>
  )
}

function Signals({ signals }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="What drove the score">
      <h2 className="text-card-title px-[18px] pt-3.5 pb-2.5">What drove the score</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead className="border-y bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th className="px-[18px] py-2 font-semibold">Signal</th>
              <th className="w-[150px] px-3 py-2 font-semibold">This voucher</th>
              <th className="w-[150px] px-3 py-2 font-semibold">Normal range</th>
              <th className="w-[90px] px-[18px] py-2 font-semibold">Impact</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 && (
              <tr>
                <td colSpan={4} className="text-caption px-[18px] py-4">
                  No signals recorded yet.
                </td>
              </tr>
            )}
            {signals.map((s) => (
              <tr key={s.key} className="border-b last:border-b-0">
                <td className="text-body px-[18px] py-2.5">{s.label}</td>
                <td className="text-body-strong px-3 py-2.5">{s.value ?? '—'}</td>
                <td className="text-caption px-3 py-2.5">{s.normal}</td>
                <td className="px-[18px] py-2.5">
                  {s.impact === 'none' ? (
                    <span className="text-caption">—</span>
                  ) : (
                    <Pill tone={IMPACT[s.impact]?.tone ?? 'neutral'}>{IMPACT[s.impact]?.text ?? s.impact}</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Choice({ value, current, onPick, title, caption }) {
  const on = current === value
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onPick(value)}
      className={cn(
        'flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        on ? 'border-[1.5px] border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
          on ? 'border-primary' : 'border-border',
        )}
      >
        {on && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-px">
        <span className="text-body-strong">{title}</span>
        <span className="text-caption">{caption}</span>
      </span>
    </button>
  )
}

/** 38000 → "38k", 98450 → "98.5k", 850 → "850". */
function shortMoney(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(n))
}

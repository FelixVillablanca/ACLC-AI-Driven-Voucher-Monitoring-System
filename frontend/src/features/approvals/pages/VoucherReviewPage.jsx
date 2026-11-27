import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, Info, Loader2, Lock, TriangleAlert, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { statusPill } from '@/features/vouchers'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadVoucherPdf, getReviewOptions, getReviewVoucher } from '../api'
import { ApproveDialog, RejectDialog, ReturnDialog } from '../components/DecisionDialogs'
import { announceReviewsChanged, flaggedPath, flagSourceText, reviewPath, supervisorNames, waitedText } from '../utils'

const PAY = { cash: 'Cash', bank: 'Bank transfer', cheque: 'Check' }

/**
 * Review one voucher (/officer/vouchers/:id; Framer jQfdHPifl, dialogs pzSaaMGhY / XT9f8T3lY / sozCOjfDk).
 * Left: the automatic check's flag (when flagged, with Investigate →), similar vouchers (a plain same-payee / close-amount check), a previous
 * return, details, lines. Right: "Your decision · Level 1": budget (before → after this voucher), checklist (a personal aid,
 * not saved), remarks, where it goes next, Approve / Return / Reject. After a decision → the next voucher.
 * Code differs from the frame: no receipts / attachment link (not built), no "AI 92%" on the category
 * (AI not switched on), budget box links to the department's Budgets page, "‹ 1 of 12 ›" follows the whole queue (oldest first).
 */
export default function VoucherReviewPage() {
  const { id } = useParams()
  // keyed by id: moving to the next voucher starts with an empty remarks box and no window open
  return <ReviewScreen key={id} id={id} />
}

function ReviewScreen({ id }) {
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', v: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${companyId}|${attempt}`

  useEffect(() => {
    let alive = true
    getReviewVoucher(id)
      .then((v) => alive && setState({ key, status: 'success', v, error: null }))
      .catch((error) => alive && setState({ key, status: 'error', v: null, error }))
    return () => {
      alive = false
    }
  }, [id, key])

  const [options, setOptions] = useState(null)
  useEffect(() => {
    let alive = true
    getReviewOptions()
      .then((o) => alive && setOptions(o))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [companyId])

  const status = state.key === key ? state.status : 'loading'
  const v = status === 'success' ? state.v : null

  const [dialog, setDialog] = useState(null) // 'approve' | 'return' | 'reject'
  const [remarks, setRemarks] = useState('')

  const done = (r, what) => {
    setDialog(null)
    announceReviewsChanged()
    toast.success(
      what === 'approve'
        ? r.forwarded
          ? `${r.voucher_number} approved and sent to ${supervisorNames(r.supervisors)} for final approval.`
          : `${r.voucher_number} approved.`
        : what === 'return'
          ? `${r.voucher_number} was sent back to the clerk.`
          : `${r.voucher_number} was rejected.`,
    )
    navigate(r.next_id ? reviewPath(r.next_id) : PATHS.OFFICER_QUEUE, { replace: true })
  }

  // another officer decided first (409 VOUCHER_ALREADY_REVIEWED): close the window and show it as it is now
  const failed = (e) => {
    toast.error(e.message, { duration: 7000 })
    setDialog(null)
    announceReviewsChanged()
    setAttempt((n) => n + 1)
  }

  const [pdfBusy, setPdfBusy] = useState(false)
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

  const pos = v?.review.position

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-16">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the voucher…</span>
        </div>
      )}

      {status === 'error' && (
        <>
          <BackLink />
          <div className="rounded-xl border bg-card">
            <ErrorState
              title={state.error.status === 404 ? 'Voucher not found' : "Couldn't load the voucher"}
              message={state.error.status === 404 ? 'It isn’t a submitted voucher of the company you’re working in.' : state.error.message}
              requestId={state.error.requestId}
              onRetry={state.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
            />
          </div>
        </>
      )}

      {v && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title">Review · {v.voucher_number}</h1>
                {v.status !== 'pending' && <Pill tone={statusPill(v.status).tone}>{statusPill(v.status).text}</Pill>}
              </div>
              <p className="text-body text-muted-foreground">
                <Link to={PATHS.OFFICER_QUEUE} className="inline-flex items-center gap-1 hover:text-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden="true" /> Review queue
                </Link>
                {'  /  '}Submitted by {[v.clerk?.name, v.names.department].filter(Boolean).join(' · ')}
                {v.submitted_at && ` · ${formatDate(v.submitted_at, 'MMM d, h:mm a')}`}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {pos && (
                <div className="flex h-[38px] items-center rounded-lg border bg-card">
                  <button
                    type="button"
                    disabled={!pos.prev_id}
                    onClick={() => navigate(reviewPath(pos.prev_id))}
                    aria-label="Previous voucher in the queue"
                    className="flex h-full items-center px-2.5 hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <span className="text-body-strong px-1 tabular-nums">
                    {pos.index} of {pos.total}
                  </span>
                  <button
                    type="button"
                    disabled={!pos.next_id}
                    onClick={() => navigate(reviewPath(pos.next_id))}
                    aria-label="Next voucher in the queue"
                    className="flex h-full items-center px-2.5 hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )}
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
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              {v.ai.flagged && <AiPanel v={v} />}
              {v.review.similar.length > 0 && <SimilarPanel v={v} />}
              <PreviousReturn history={v.history} />
              <DetailsCard v={v} />
              <LinesCard v={v} />
            </div>

            <aside className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:w-[310px] lg:shrink-0">
              {v.review.can_act ? (
                <DecisionPanel v={v} remarks={remarks} setRemarks={setRemarks} onOpen={setDialog} />
              ) : (
                <ClosedPanel v={v} />
              )}
            </aside>
          </div>
        </>
      )}

      <AnimatePresence>
        {v && dialog === 'approve' && (
          <ApproveDialog
            key="a"
            voucher={v}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={failed}
            onDone={(r) => done(r, 'approve')}
          />
        )}
        {v && dialog === 'return' && (
          <ReturnDialog
            key="r"
            voucher={v}
            options={options}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={failed}
            onDone={(r) => done(r, 'return')}
          />
        )}
        {v && dialog === 'reject' && (
          <RejectDialog
            key="x"
            voucher={v}
            options={options}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={failed}
            onDone={(r) => done(r, 'reject')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink() {
  return (
    <Link to={PATHS.OFFICER_QUEUE} className="text-caption flex w-fit items-center gap-1 hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Review queue
    </Link>
  )
}

function AiPanel({ v }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-danger bg-danger-soft px-[18px] py-4" aria-label="Flagged">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-body-strong flex items-center gap-1.5 text-danger">
          <TriangleAlert className="size-4" aria-hidden="true" /> {flagSourceText(v.ai.source)} · flagged
        </p>
        {v.ai.score && <span className="text-badge rounded-full bg-danger px-2.5 py-0.5 text-white">Score {v.ai.score}</span>}
      </div>
      <p className="text-body">{v.ai.reason ?? 'The automatic check flagged this voucher as unusual.'}</p>
      <Link to={flaggedPath(v.id)} className="text-auth-link w-fit text-danger hover:underline">
        Investigate the flag →
      </Link>
    </section>
  )
}

/** Same payee, a total within 15%, last 120 days: a plain check, not AI (Framer's duplicate comparison). */
function SimilarPanel({ v }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-soft px-[18px] py-4" aria-label="Similar vouchers">
      <div className="flex flex-col gap-0.5">
        <p className="text-body-strong flex items-center gap-1.5 text-warning">
          <Copy className="size-4" aria-hidden="true" /> Possible duplicate?{' '}
          {v.review.similar.length === 1 ? 'A similar voucher' : 'Similar vouchers'}
        </p>
        <p className="text-caption">
          Same payee, a total within 15%, submitted in the last 120 days. Check the periods and reference numbers.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Compare
          label="This voucher"
          highlight
          number={v.voucher_number}
          amount={v.amount}
          lines={[v.reference_number && `Reference: ${v.reference_number}`, v.description && v.description.slice(0, 90)]}
        />
        {v.review.similar.map((s) => (
          <Compare
            key={s.id}
            label={`${statusPill(s.status).text} · ${formatDate(s.approved_at ?? s.submitted_at, 'MMM d')}`}
            number={s.voucher_number}
            amount={s.amount}
            to={reviewPath(s.id)}
            lines={[s.reference_number && `Reference: ${s.reference_number}`, s.summary]}
          />
        ))}
      </div>
    </section>
  )
}

function Compare({ label, number, amount, lines, highlight, to }) {
  const body = (
    <>
      <span className={cn('text-badge uppercase', highlight ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
      <span className="text-body-strong">
        {number} · {formatMoney(amount)}
      </span>
      {lines.filter(Boolean).map((l) => (
        <span key={l} className="text-caption truncate">
          {l}
        </span>
      ))}
    </>
  )
  const cls = cn('flex min-w-0 flex-col gap-1 rounded-lg bg-card p-3', highlight ? 'border-[1.5px] border-primary' : 'border')
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-primary')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** A resubmitted voucher: what the last reviewer asked for, so you can check it was fixed. */
function PreviousReturn({ history }) {
  const last = [...(history ?? [])].reverse().find((h) => h.action === 'returned')
  if (!last) return null
  return (
    <section className="flex gap-2.5 rounded-xl border bg-card px-[18px] py-3.5" aria-label="Sent back before">
      <Undo2 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-body-strong">
          Resubmitted · sent back {last.at ? formatTimeAgo(last.at) : ''} by {last.by ?? 'a reviewer'}
        </p>
        {last.needs_changes?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {last.needs_changes.map((t) => (
              <Pill key={t} tone="warning">
                {t}
              </Pill>
            ))}
          </div>
        )}
        {last.remarks && <p className="text-body text-muted-foreground">“{last.remarks}”</p>}
      </div>
    </section>
  )
}

function DetailsCard({ v }) {
  const facts = [
    ['Payee', [v.payee_name, v.names.payee_type].filter(Boolean).join(' · ')],
    ['Category', v.category?.name],
    ['Payment', PAY[v.payment_method] ?? v.payment_method],
    ['Voucher date', v.submitted_at ? formatDate(v.submitted_at, 'MMM d, yyyy') : null],
    ['Department', v.names.department],
    ['Voucher type', v.names.voucher_type],
    ['Reference', v.reference_number],
    ['Due date', v.due_date ? formatDate(v.due_date, 'MMM d, yyyy') : null],
  ]
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] py-4" aria-label="Voucher details">
      <h2 className="text-card-title">Voucher details</h2>
      <dl className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption">{label}</dt>
            <dd className={cn('text-body-strong break-words', !value && 'font-normal text-muted-foreground')}>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {v.payment_method === 'bank' && (
        <p className="text-body">
          <span className="text-caption">Bank: </span>
          {[v.bank_name, v.bank_account_name, v.bank_account_number].filter(Boolean).join(' · ') || '—'}
        </p>
      )}
      {v.description && <p className="text-body whitespace-pre-line">{v.description}</p>}
      {v.purpose && (
        <p className="text-body whitespace-pre-line">
          <span className="text-caption">Notes for the reviewer: </span>
          {v.purpose}
        </p>
      )}
    </section>
  )
}

function LinesCard({ v }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Line items">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead className="border-b bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th className="px-[18px] py-2 font-semibold">Line item</th>
              <th className="w-[90px] px-3 py-2 text-right font-semibold">Qty</th>
              <th className="w-[110px] px-3 py-2 text-right font-semibold">Unit price</th>
              <th className="w-[120px] px-[18px] py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.line_items.length === 0 && (
              <tr>
                <td colSpan={4} className="text-caption px-[18px] py-4">
                  No lines.
                </td>
              </tr>
            )}
            {v.line_items.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="text-body px-[18px] py-2.5">{l.description}</td>
                <td className="text-body px-3 py-2.5 text-right tabular-nums">
                  {Number(l.quantity)} {l.unit}
                </td>
                <td className="text-body px-3 py-2.5 text-right tabular-nums">{formatMoney(l.unit_price)}</td>
                <td className="text-body-strong px-[18px] py-2.5 text-right tabular-nums">{formatMoney(l.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 border-t bg-muted px-[18px] py-3">
        <span className="text-card-title tabular-nums">Total {formatMoney(v.amount)}</span>
      </div>
    </section>
  )
}

function DecisionPanel({ v, remarks, setRemarks, onOpen }) {
  const reasons = v.review.step2_reasons
  const sups = v.review.supervisors
  const linesAddUp = sumLines(v.line_items) === v.amount

  const checks = [
    { key: 'lines', label: 'Line items add up to the total', auto: linesAddUp },
    { key: 'category', label: 'Correct category & department' },
    { key: 'payee', label: 'Payee and payment details are right' },
    ...(v.review.similar.length ? [{ key: 'similar', label: 'Similar vouchers checked (not a duplicate)' }] : []),
    ...(v.ai.flagged ? [{ key: 'ai', label: 'Flag investigated' }] : []),
  ]
  const [ticked, setTicked] = useState(() => new Set(linesAddUp ? ['lines'] : []))
  const toggle = (k) =>
    setTicked((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <>
      <h2 className="text-card-title">Your decision · Level 1</h2>
      <BudgetBox budget={v.review.budget} department={v.names.department} />

      {v.review.sla.state !== 'ok' && (
        <p
          className={cn(
            'text-caption rounded-lg px-3 py-2',
            v.review.sla.state === 'over' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
          )}
        >
          ⏱ Waiting {waitedText(v.submitted_at)} · {v.review.sla.state === 'over' ? 'past' : 'close to'} the {v.review.sla.hours} h review
          target
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-table-head text-muted-foreground">Checklist</p>
        {checks.map((c) => (
          <label key={c.key} className="text-body flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={ticked.has(c.key)} onChange={() => toggle(c.key)} className="mt-0.5 size-4 accent-primary" />
            <span>
              {c.label}
              {c.key === 'lines' && (
                <span className={cn('text-caption block', linesAddUp ? 'text-success' : 'text-danger')}>
                  {linesAddUp ? 'Checked by ADVMS' : 'They don’t: check the lines'}
                </span>
              )}
            </span>
          </label>
        ))}
        <p className="text-caption">For you only; it isn’t saved.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="r-remarks" className="text-label">
          Remarks
        </label>
        <textarea
          id="r-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Optional for approval · required to return or reject"
          className="text-body w-full resize-y rounded-lg border bg-card px-3 py-2 outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {reasons.length > 0 ? (
        <p className="text-caption flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-foreground">
          <span className="text-warning">→</span>
          <span>
            {reasons.includes('ai_flagged') ? 'Flagged' : 'High value'}: after you approve, it goes to {supervisorNames(sups)} (Supervisor)
            for final approval.
            {sups.length === 0 && ' Nobody is a Supervisor in this company yet, so it will wait until one is added.'}
          </span>
        </p>
      ) : (
        <p className="text-caption flex gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-foreground">
          <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
          Your approval is final: below the high-value amount and not flagged.
        </p>
      )}

      <button
        type="button"
        onClick={() => onOpen('approve')}
        className="text-auth-button flex h-10 items-center justify-center gap-1.5 rounded-lg bg-success text-white outline-none hover:bg-success/90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Check className="size-4" aria-hidden="true" /> {reasons.length ? 'Approve & forward' : 'Approve'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpen('return')}
          className="text-body-strong flex h-10 items-center justify-center gap-1.5 rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Undo2 className="size-4" aria-hidden="true" /> Return
        </button>
        <button
          type="button"
          onClick={() => onOpen('reject')}
          className="text-body-strong flex h-10 items-center justify-center gap-1.5 rounded-lg border border-danger bg-danger-soft text-danger outline-none hover:bg-danger-soft/70 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" /> Reject
        </button>
      </div>
    </>
  )
}

/** The department's yearly budget before → after this voucher (yearly + used on final approval since 2026-11-27). */
function BudgetBox({ budget, department }) {
  if (!budget) {
    return (
      <p className="text-caption flex gap-2 rounded-lg bg-muted px-3 py-2.5">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {department ? `No budget is set for ${department} this year.` : 'This voucher has no department, so there’s no budget to check.'}
      </p>
    )
  }
  const over = budget.after_pct > 100
  const near = !over && budget.after_pct >= budget.alert_pct
  const tone = over ? 'danger' : near ? 'warning' : 'success'
  const TONE = {
    success: { box: 'bg-success-soft', text: 'text-success', bar: 'bg-success' },
    warning: { box: 'bg-warning-soft', text: 'text-warning', bar: 'bg-warning' },
    danger: { box: 'bg-danger-soft', text: 'text-danger', bar: 'bg-danger' },
  }[tone]
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-lg p-3', TONE.box)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-badge', TONE.text)}>{over ? '⚠ Over budget' : near ? '⚠ Near the alert level' : '✓ Within budget'}</span>
        <span className="text-caption truncate">{department}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-card"
        role="progressbar"
        aria-valuenow={budget.after_pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Budget used after this voucher"
      >
        <div className={cn('h-full rounded-full', TONE.bar)} style={{ width: `${Math.min(100, budget.after_pct)}%` }} />
      </div>
      <span className="text-caption">
        {budget.used_pct}% used → {budget.after_pct}% after this voucher · {budget.period}
      </span>
      <span className="text-caption">
        Its final approval adds it to the budget (going over warns, it doesn’t block).{' '}
        <Link to={`${PATHS.OFFICER_BUDGETS}/${budget.department_id}`} className="text-primary hover:underline">
          View budget
        </Link>
      </span>
    </div>
  )
}

/** Not actionable: already decided, or the officer's own voucher. */
function ClosedPanel({ v }) {
  const last = [...(v.history ?? [])].reverse()[0]
  return (
    <>
      <h2 className="text-card-title flex items-center gap-1.5">
        <Lock className="size-4 text-muted-foreground" aria-hidden="true" /> No decision needed
      </h2>
      <p className="text-body">
        {v.review.own_voucher
          ? 'You created this voucher, so another officer must review it (segregation of duties).'
          : v.status === 'under_review'
            ? 'Accounting approved it; it’s with the Supervisor / Manager for final approval.'
            : `It’s ${statusPill(v.status)
                .text.replace(/^[^A-Za-z]+/, '')
                .toLowerCase()}.`}
      </p>
      {last && (
        <div className="flex flex-col gap-1 rounded-lg bg-muted px-3 py-2.5">
          <span className="text-body-strong">
            {last.action === 'approved'
              ? 'Approved'
              : last.action === 'returned'
                ? 'Sent back'
                : last.action === 'rejected'
                  ? 'Rejected'
                  : 'Noted'}{' '}
            by {last.by ?? 'a reviewer'}
          </span>
          {last.at && <span className="text-caption">{formatDate(last.at, 'MMM d, h:mm a')}</span>}
          {last.reason && <span className="text-caption">Reason: {last.reason}</span>}
          {last.remarks && <span className="text-body">“{last.remarks}”</span>}
        </div>
      )}
      <Link to={PATHS.OFFICER_QUEUE} className="text-auth-link text-primary hover:underline">
        Back to the review queue →
      </Link>
    </>
  )
}

/** Sum of the lines' totals as a "0.00" string (centavos, no float drift). */
function sumLines(lines) {
  const cents = lines.reduce((s, l) => s + Math.round(Number(l.total_price) * 100), 0)
  return (cents / 100).toFixed(2)
}

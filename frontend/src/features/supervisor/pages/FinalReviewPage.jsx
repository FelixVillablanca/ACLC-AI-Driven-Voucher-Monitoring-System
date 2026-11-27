import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Printer, TriangleAlert, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadLevel2Pdf, getLevel2Voucher, getSupervisorOptions } from '../api'
import { FinalApproveDialog, Level2RejectDialog, Level2ReturnDialog } from '../components/Level2Dialogs'
import { BudgetImpact, Similar, Trail } from '../components/ReviewParts'
import { announceDecisionsChanged, level2Path, outlineBtn, primaryBtn, STATUS } from '../utils'

const PAYMENT = { cash: 'Cash', bank_transfer: 'Bank transfer', check: 'Check' }

/**
 * FINAL REVIEW (/supervisor/vouchers/:id; Framer Nl0dfYkY_ + the WQL6Ca1ML / PlbU6CVEj / tW_30cpOE dialogs), 2026-11-27.
 * Left: the voucher (payee, category, payment, amount, lines) and the approval trail. Right: the flag from the automatic
 * check, the budget impact and "Your decision" (remarks + Final approve / Return / Reject). After a decision it opens
 * the next voucher in the queue, or goes back to the queue when it's empty.
 * Code differs from the frame: no attachments (not built), no "AI 96% match" on the category (no AI classification
 * yet); "Flagged" by the automatic check, not "AI anomaly flag"; similar vouchers are listed inline.
 */
export default function FinalReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', v: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [options, setOptions] = useState(null)
  const [dialog, setDialog] = useState(null) // 'approve' | 'return' | 'reject'
  const [remarks, setRemarks] = useState('')
  const [showSimilar, setShowSimilar] = useState(false)
  const key = `${companyId}|${id}|${attempt}`

  useEffect(() => {
    let alive = true
    getLevel2Voucher(id)
      .then((v) => alive && setState({ key, status: 'success', v, error: null }))
      .catch((error) => alive && setState({ key, status: 'error', v: null, error }))
    return () => {
      alive = false
    }
  }, [key, id])
  useEffect(() => {
    getSupervisorOptions()
      .then(setOptions)
      .catch(() => {})
  }, [])

  const status = state.key === key ? state.status : 'loading'
  const v = status === 'success' ? state.v : null
  usePageTitle(v?.voucher_number ? `Final review ${v.voucher_number}` : 'Final review')

  const done = (r, message) => {
    setDialog(null)
    setRemarks('')
    announceDecisionsChanged()
    toast.success(message)
    navigate(r.next_id ? level2Path(r.next_id) : PATHS.SUPERVISOR_QUEUE)
  }
  const conflict = (e) => {
    setDialog(null)
    toast.error(e.message)
    announceDecisionsChanged()
    setAttempt((n) => n + 1)
  }

  if (status === 'error') {
    const missing = state.error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
        <BackLink />
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={missing ? 'Voucher not found' : "Couldn't load this voucher"}
            message={missing ? 'It isn’t a voucher of the company you’re working in.' : state.error.message}
            requestId={missing ? undefined : state.error.requestId}
            onRetry={missing ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      </div>
    )
  }

  const r = v?.review
  const canAct = r?.can_act

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title truncate">{v ? `${v.voucher_number}${v.summary ? ` · ${v.summary}` : ''}` : 'Final review'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink inline />
            {v && (
              <span>
                / {v.names?.department ?? 'No department'} · submitted by {v.clerk?.name ?? 'the clerk'}{' '}
                {formatDate(v.submitted_at, 'MMM d')}
                {r.level1 ? ` · passed Level 1 ${formatDate(r.level1.at, 'MMM d')}` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {r?.position && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!r.position.prev_id}
                onClick={() => navigate(level2Path(r.position.prev_id))}
                aria-label="Previous voucher"
                className={cn(outlineBtn, 'w-[38px] px-0')}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="text-caption px-1 tabular-nums">
                {r.position.index} of {r.position.total}
              </span>
              <button
                type="button"
                disabled={!r.position.next_id}
                onClick={() => navigate(level2Path(r.position.next_id))}
                aria-label="Next voucher"
                className={cn(outlineBtn, 'w-[38px] px-0')}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={!v}
            onClick={() => downloadLevel2Pdf(v.id).catch((e) => toast.error(e.message))}
            className={outlineBtn}
          >
            <Printer className="size-4" aria-hidden="true" /> Voucher PDF
          </button>
          {canAct && (
            <button type="button" onClick={() => setDialog('approve')} className={primaryBtn}>
              <Check className="size-4" aria-hidden="true" /> Final approve
            </button>
          )}
        </div>
      </div>

      {status === 'loading' && <Skeleton />}

      {v && (
        <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
            <Details v={v} />
            <Trail v={v} />
          </div>

          <div className="flex w-full flex-col gap-3.5 lg:w-[340px] lg:shrink-0">
            {v.ai.flagged && (
              <section className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger-soft p-4" aria-labelledby="l2-flag">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="l2-flag" className="text-badge flex items-center gap-1.5 text-danger">
                    <TriangleAlert className="size-4" aria-hidden="true" /> Flagged by the automatic check
                  </h2>
                  {v.ai.score && <span className="text-card-title text-danger tabular-nums">{Number(v.ai.score).toFixed(2)}</span>}
                </div>
                <p className="text-body text-foreground">{v.ai.reason ?? 'The check found this voucher unusual for this company.'}</p>
                {r.similar.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSimilar((s) => !s)}
                    className="text-auth-link self-start text-primary hover:underline"
                  >
                    {showSimilar ? 'Hide similar vouchers' : `See similar vouchers (${r.similar.length}) →`}
                  </button>
                )}
                {showSimilar && <Similar items={r.similar} />}
              </section>
            )}
            {!v.ai.flagged && r.similar.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <h2 className="text-card-title">Similar vouchers</h2>
                <Similar items={r.similar} />
              </section>
            )}

            <BudgetImpact budget={r.budget} department={v.names?.department} />

            {canAct ? (
              <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-4" aria-labelledby="l2-decision">
                <h2 id="l2-decision" className="text-card-title">
                  Your decision
                </h2>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  aria-label="Remarks"
                  placeholder={v.ai.flagged ? 'Remarks (required for flagged vouchers)…' : 'Remarks (optional for approval)…'}
                  className={cn(inputClass, 'h-auto resize-y py-2')}
                />
                <button type="button" onClick={() => setDialog('approve')} className={primaryBtn}>
                  <Check className="size-4" aria-hidden="true" /> Final approve
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDialog('return')} className={cn(outlineBtn, 'text-warning')}>
                    <Undo2 className="size-4" aria-hidden="true" /> Return
                  </button>
                  <button type="button" onClick={() => setDialog('reject')} className={cn(outlineBtn, 'text-danger')}>
                    <X className="size-4" aria-hidden="true" /> Reject
                  </button>
                </div>
              </section>
            ) : (
              <section className="flex flex-col gap-1.5 rounded-xl border bg-muted p-4">
                <h2 className="text-card-title">No decision needed</h2>
                <p className="text-caption">
                  {r.own_voucher
                    ? 'You created this voucher, so another Supervisor has to decide on it (segregation of duties).'
                    : `It’s ${STATUS[v.status]?.label.toLowerCase() ?? v.status}.`}
                </p>
                <Link to={PATHS.SUPERVISOR_QUEUE} className="text-auth-link text-primary hover:underline">
                  Back to the approval queue →
                </Link>
              </section>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {dialog === 'approve' && v && (
          <FinalApproveDialog
            key="approve"
            voucher={v}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(res) => done(res, `${v.voucher_number} approved and released for payment.`)}
          />
        )}
        {dialog === 'return' && v && (
          <Level2ReturnDialog
            key="return"
            voucher={v}
            options={options}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(res) => done(res, `${v.voucher_number} was sent back to ${res.sent_to === 'clerk' ? 'the clerk' : 'Accounting'}.`)}
          />
        )}
        {dialog === 'reject' && v && (
          <Level2RejectDialog
            key="reject"
            voucher={v}
            options={options}
            initialRemarks={remarks}
            onCancel={() => setDialog(null)}
            onConflict={conflict}
            onDone={(res) => done(res, `${v.voucher_number} was rejected.`)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink({ inline }) {
  return (
    <Link
      to={PATHS.SUPERVISOR_QUEUE}
      className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Approval queue
    </Link>
  )
}

function Details({ v }) {
  const s = STATUS[v.status] ?? { tone: 'neutral', label: v.status }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-labelledby="l2-details">
      <div className="flex items-center justify-between gap-2">
        <h2 id="l2-details" className="text-card-title">
          Voucher details
        </h2>
        <Pill tone={s.tone}>{s.label}</Pill>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Fact label="Payee" value={v.payee_name ?? '—'} sub={v.names?.payee_type} />
        <Fact label="Category" value={v.category?.name ?? '—'} />
        <Fact label="Payment" value={PAYMENT[v.payment_method] ?? v.payment_method ?? '—'} sub={v.names?.voucher_type} />
        <Fact label="Amount" value={formatMoney(v.amount)} strong />
      </div>
      {(v.description || v.purpose) && <p className="text-body text-muted-foreground">{v.description || v.purpose}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-left">
          <thead className="border-b bg-muted">
            <tr className="text-table-head text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="w-[100px] px-3 py-2 font-semibold">Qty</th>
              <th className="w-[120px] px-3 py-2 text-right font-semibold">Unit price</th>
              <th className="w-[130px] px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.line_items.map((l) => (
              <tr key={l.id} className="border-b last:border-b-0">
                <td className="text-body px-3 py-2">{l.description}</td>
                <td className="text-body px-3 py-2 tabular-nums">
                  {Number(l.quantity).toLocaleString('en-US')} {l.unit ?? ''}
                </td>
                <td className="text-body px-3 py-2 text-right tabular-nums">{formatMoney(l.unit_price)}</td>
                <td className="text-body-strong px-3 py-2 text-right tabular-nums">{formatMoney(l.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Fact({ label, value, sub, strong }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption">{label}</span>
      <span className={cn('truncate tabular-nums', strong ? 'text-card-title' : 'text-body-strong')}>{value}</span>
      {sub && <span className="text-caption truncate">{sub}</span>}
    </div>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the voucher" className="flex flex-col gap-3.5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3.5">
        <div className="h-[320px] animate-pulse rounded-xl border bg-card" />
        <div className="h-[180px] animate-pulse rounded-xl border bg-card" />
      </div>
      <div className="h-[420px] w-full animate-pulse rounded-xl border bg-card lg:w-[340px]" />
    </div>
  )
}

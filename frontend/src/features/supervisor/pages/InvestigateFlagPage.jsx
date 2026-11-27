import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Printer, TriangleAlert, Undo2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { inputClass } from '@/components/common/FieldShell'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { downloadLevel2Pdf, getLevel2Investigation, getLevel2Voucher, getSupervisorOptions } from '../api'
import { FinalApproveDialog, Level2RejectDialog, Level2ReturnDialog } from '../components/Level2Dialogs'
import { BudgetImpact, Similar, Trail } from '../components/ReviewParts'
import { announceDecisionsChanged, level2Path, outlineBtn, primaryBtn, STATUS } from '../utils'

const IMPACT = {
  high: { box: 'border-danger/40 bg-danger-soft', text: 'text-danger', label: 'High' },
  medium: { box: 'border-warning/40 bg-warning-soft', text: 'text-warning', label: 'Medium' },
  low: { box: 'bg-card', text: 'text-success', label: 'Low' },
  none: { box: 'bg-card', text: 'text-muted-foreground', label: '—' },
}
const RANK = { high: 0, medium: 1, low: 2, none: 3 }
const PAST_STATUS = {
  pending: { tone: 'warning', label: 'With Accounting' },
  under_review: { tone: 'primary', label: 'With Supervisor' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  returned: { tone: 'warning', label: 'Returned' },
}

/**
 * INVESTIGATE FLAG at Level 2 (/supervisor/flagged/:id; Framer lFqUUsfzi), 2026-11-27. Left: why it was flagged (the
 * check's stored signals as tiles), past vouchers to the same payee, the approval trail. Right: the flag, the budget
 * impact and "Your decision" (the same Final approve / Return / Reject dialogs as the final review). After a decision
 * it goes back to the flagged list.
 * Code differs from the frame: "Flagged by the automatic check" (rules), not "AI anomaly flag"; tiles show every signal
 * the check stored (not a fixed three); past vouchers show their real status ("Approved", not "Paid": payments
 * aren't tracked).
 */
export default function InvestigateFlagPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', v: null, inv: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [options, setOptions] = useState(null)
  const [dialog, setDialog] = useState(null) // 'approve' | 'return' | 'reject'
  const [remarks, setRemarks] = useState('')
  const [showSimilar, setShowSimilar] = useState(false)
  const key = `${companyId}|${id}|${attempt}`

  useEffect(() => {
    let alive = true
    Promise.all([getLevel2Voucher(id), getLevel2Investigation(id)])
      .then(([v, inv]) => alive && setState({ key, status: 'success', v, inv, error: null }))
      .catch((error) => alive && setState({ key, status: 'error', v: null, inv: null, error }))
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
  const inv = status === 'success' ? state.inv : null
  usePageTitle(v?.voucher_number ? `Investigate ${v.voucher_number}` : 'Investigate flag')

  const done = (message) => {
    setDialog(null)
    setRemarks('')
    announceDecisionsChanged()
    toast.success(message)
    navigate(PATHS.SUPERVISOR_FLAGGED)
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
            title={missing ? 'Voucher not found' : "Couldn't load this flag"}
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
  const signals = inv ? [...inv.signals].sort((a, b) => (RANK[a.impact] ?? 9) - (RANK[b.impact] ?? 9)) : []

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title truncate">{v ? `Investigate flag · ${v.voucher_number}` : 'Investigate flag'}</h1>
          <p className="text-body flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <BackLink inline />
            {v && <span>/ {[v.summary, formatMoney(v.amount), v.payee_name].filter(Boolean).join(' · ')}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
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

      {v && inv && (
        <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-[18px]">
            {!inv.flagged && (
              <p className="text-body rounded-xl border bg-muted px-4 py-3">
                This voucher isn&apos;t flagged{inv.finding === 'false_alarm' ? ' any more: Accounting cleared it as a false alarm' : ''}.{' '}
                <Link to={level2Path(v.id)} className="text-auth-link text-primary hover:underline">
                  Open the final review →
                </Link>
              </p>
            )}

            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5" aria-labelledby="inv-why">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="inv-why" className="text-card-title">
                  Why it was flagged
                </h2>
                {inv.department && inv.category && (
                  <span className="text-caption">
                    {inv.category} · {inv.department}
                  </span>
                )}
              </div>
              {signals.length === 0 ? (
                <p className="text-caption">
                  {inv.checked ? 'The check stored no signals for this voucher.' : 'The automatic check hasn’t run on this voucher yet.'}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {signals.map((s) => {
                    const look = IMPACT[s.impact] ?? IMPACT.none
                    return (
                      <div key={s.key} className={cn('flex flex-col gap-1 rounded-lg border p-3.5', look.box)}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption">{s.label}</span>
                          {s.impact !== 'none' && <span className={cn('text-badge', look.text)}>{look.label}</span>}
                        </div>
                        <span className={cn('text-card-title tabular-nums', s.impact === 'high' || s.impact === 'medium' ? look.text : '')}>
                          {s.value ?? '—'}
                        </span>
                        <span className="text-caption">Normal: {s.normal}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {inv.summary && <p className="text-body text-muted-foreground">{inv.summary}</p>}
            </section>

            <PastPayments payee={v.payee_name} items={inv.past_payments} />
            <Trail v={v} />
          </div>

          <div className="flex w-full flex-col gap-3.5 lg:w-[340px] lg:shrink-0">
            {inv.flagged && (
              <section className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger-soft p-4" aria-labelledby="inv-flag">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="inv-flag" className="text-badge flex items-center gap-1.5 text-danger">
                    <TriangleAlert className="size-4" aria-hidden="true" /> Flagged by the automatic check
                  </h2>
                  {inv.score && <span className="text-card-title text-danger tabular-nums">{Number(inv.score).toFixed(2)}</span>}
                </div>
                <p className="text-body text-foreground">{v.ai.reason ?? 'The check found this voucher unusual for this company.'}</p>
                {inv.threshold && <p className="text-caption">Flagged at a score of {Number(inv.threshold).toFixed(2)} or more.</p>}
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

            <BudgetImpact budget={r.budget} department={v.names?.department} />

            {canAct ? (
              <section className="flex flex-col gap-2.5 rounded-xl border bg-card p-4" aria-labelledby="inv-decision">
                <h2 id="inv-decision" className="text-card-title">
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
                <Link to={PATHS.SUPERVISOR_FLAGGED} className="text-auth-link text-primary hover:underline">
                  Back to flagged vouchers →
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
            onDone={() => done(`${v.voucher_number} approved and released for payment.`)}
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
            onDone={(res) => done(`${v.voucher_number} was sent back to ${res.sent_to === 'clerk' ? 'the clerk' : 'Accounting'}.`)}
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
            onDone={() => done(`${v.voucher_number} was rejected.`)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function BackLink({ inline }) {
  return (
    <Link
      to={PATHS.SUPERVISOR_FLAGGED}
      className={cn('text-auth-link inline-flex items-center gap-1 text-primary hover:underline', !inline && 'self-start')}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" /> Flagged
    </Link>
  )
}

function PastPayments({ payee, items }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="inv-past">
      <h2 id="inv-past" className="text-card-title px-5 pt-4 pb-3">
        Past vouchers to {payee ?? 'this payee'}
      </h2>
      {items.length === 0 ? (
        <p className="text-caption px-5 pb-4">This is the first voucher to this payee in this company.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="border-y bg-muted">
              <tr className="text-table-head text-muted-foreground">
                <th className="px-5 py-2 font-semibold">Voucher</th>
                <th className="px-3 py-2 font-semibold">Items</th>
                <th className="w-[130px] px-3 py-2 text-right font-semibold">Amount</th>
                <th className="w-[140px] px-5 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const s = PAST_STATUS[p.status] ?? { tone: 'neutral', label: p.status }
                return (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="text-body-strong px-5 py-2.5">
                      <Link to={level2Path(p.id)} className="hover:text-primary hover:underline">
                        {p.voucher_number}
                      </Link>
                    </td>
                    <td className="text-body px-3 py-2.5">
                      {[p.summary, p.submitted_at && formatDate(p.submitted_at, 'MMM d, yyyy')].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="text-body-strong px-3 py-2.5 text-right tabular-nums">{formatMoney(p.amount)}</td>
                    <td className="px-5 py-2.5">
                      <Pill tone={s.tone}>{s.label}</Pill>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading the flag" className="flex flex-col gap-3.5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3.5">
        <div className="h-[200px] animate-pulse rounded-xl border bg-card" />
        <div className="h-[200px] animate-pulse rounded-xl border bg-card" />
        <div className="h-[160px] animate-pulse rounded-xl border bg-card" />
      </div>
      <div className="h-[420px] w-full animate-pulse rounded-xl border bg-card lg:w-[340px]" />
    </div>
  )
}

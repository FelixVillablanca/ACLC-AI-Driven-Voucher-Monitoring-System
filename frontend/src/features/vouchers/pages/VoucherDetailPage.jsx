import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Ban, CheckCircle2, Flag, Loader2, Pencil, Send, Undo2, UserCheck, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo } from '@/lib/formatters'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { cancelVoucher, getVoucher, submitVoucher } from '../api'
import { announceVouchersChanged, PAYMENT_LABELS, PRIORITY_LABELS, statusPill } from '../utils'

const ACTION_LOOK = {
  approved: { icon: CheckCircle2, tone: 'text-success', text: 'Approved' },
  rejected: { icon: XCircle, tone: 'text-danger', text: 'Rejected' },
  returned: { icon: Undo2, tone: 'text-danger', text: 'Sent back' },
  noted: { icon: UserCheck, tone: 'text-primary', text: 'Noted' },
}

/**
 * One voucher (/clerk/vouchers/:id): what it is, its lines and total, the reviewers' history (with their
 * notes), and what the clerk can do now: Edit / Submit / Cancel (drafts and returned vouchers only).
 * A submit that's missing something sends you to the form, where the missing fields are marked.
 */
export default function VoucherDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [state, setState] = useState({ key: null, status: 'loading', voucher: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const key = `${id}|${companyId}|${attempt}`

  useEffect(() => {
    let alive = true
    getVoucher(id)
      .then((voucher) => alive && setState({ key, status: 'success', voucher, error: null }))
      .catch((error) => alive && setState({ key, status: 'error', voucher: null, error }))
    return () => {
      alive = false
    }
  }, [id, key])

  const status = state.key === key ? state.status : 'loading'
  const v = state.key === key ? state.voucher : null

  const submit = async () => {
    setBusy('submit')
    try {
      const sent = await submitVoucher(v.id)
      announceVouchersChanged()
      toast.success(`${sent.voucher_number} was sent to the Accounting Officers.`)
      setAttempt((n) => n + 1)
    } catch (error) {
      if (error.status === 422) {
        toast.error('Some details are missing. They’re marked in the form.', { duration: 6000 })
        navigate(`${PATHS.CLERK_VOUCHERS}/${v.id}/edit`)
        return
      }
      toast.error(error.message)
      if (error.status === 409) setAttempt((n) => n + 1)
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    setBusy('cancel')
    try {
      await cancelVoucher(v.id)
      announceVouchersChanged()
      toast.success('Voucher cancelled.')
      setConfirmCancel(false)
      setAttempt((n) => n + 1)
    } catch (error) {
      toast.error(error.message)
      setConfirmCancel(false)
      if (error.status === 409) setAttempt((n) => n + 1)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-6 sm:px-7">
      <Link to={PATHS.CLERK_VOUCHERS} className="text-caption flex w-fit items-center gap-1 hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> My vouchers
      </Link>

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-16">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the voucher…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={state.error.status === 404 ? 'Voucher not found' : "Couldn't load the voucher"}
            message={state.error.status === 404 ? "It isn't one of your vouchers in the company you're working in." : state.error.message}
            requestId={state.error.requestId}
            onRetry={state.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {v && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-page-title">{v.voucher_number ?? 'Draft voucher'}</h1>
                <Pill tone={statusPill(v.status).tone}>{statusPill(v.status).text}</Pill>
                {v.ai_flagged && (
                  <span className="text-badge flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-danger">
                    <Flag className="size-3" aria-hidden="true" /> AI flagged
                  </span>
                )}
              </div>
              <p className="text-body text-muted-foreground">
                {v.payee_name ?? 'No payee yet'} · {v.category?.name ?? 'No category'}
                {v.submitted_at
                  ? ` · submitted ${formatTimeAgo(v.submitted_at)}`
                  : ` · ${v.voucher_number ? '' : 'not submitted yet · '}last saved ${formatTimeAgo(v.updated_at)}`}
              </p>
            </div>
            {v.can.edit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  disabled={Boolean(busy)}
                  className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg px-3 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Ban className="size-4" aria-hidden="true" /> Cancel voucher
                </button>
                <Link
                  to={`${PATHS.CLERK_VOUCHERS}/${v.id}/edit`}
                  className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Pencil className="size-4" aria-hidden="true" /> {v.status === 'returned' ? 'Fix' : 'Edit'}
                </Link>
                <button
                  type="button"
                  onClick={submit}
                  disabled={Boolean(busy)}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {busy === 'submit' ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {v.status === 'returned' ? 'Resubmit' : 'Submit'}
                </button>
              </div>
            )}
          </div>

          {v.status === 'pending' && (
            <p className="text-body rounded-xl border border-dashed bg-muted px-4 py-3">
              With the Accounting Officers of this company. You can't change it while it's being reviewed.{' '}
              <Link to={PATHS.CLERK_APPROVAL_GUIDE} className="text-primary hover:underline">
                How approval works
              </Link>
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-xl border bg-card">
                <h2 className="text-card-title border-b px-4 py-3">Lines</h2>
                {v.line_items.length === 0 ? (
                  <p className="text-caption px-4 py-6">No lines yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left">
                      <thead>
                        <tr className="text-table-head border-b bg-muted text-muted-foreground">
                          <th className="px-4 py-2">Description</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Unit price</th>
                          <th className="px-4 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.line_items.map((l) => (
                          <tr key={l.id} className="border-b last:border-b-0">
                            <td className="text-body px-4 py-2.5">{l.description}</td>
                            <td className="text-body px-4 py-2.5 text-right tabular-nums">
                              {Number(l.quantity)} {l.unit}
                            </td>
                            <td className="text-body px-4 py-2.5 text-right tabular-nums">{formatMoney(l.unit_price)}</td>
                            <td className="text-body-strong px-4 py-2.5 text-right tabular-nums">{formatMoney(l.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end gap-3 border-t bg-muted px-4 py-3">
                  <span className="text-body">Total</span>
                  <span className="text-card-title tabular-nums">{formatMoney(v.amount)}</span>
                </div>
              </section>

              {(v.description || v.purpose) && (
                <section className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
                  {v.description && <Fact label="What it's for" value={v.description} />}
                  {v.purpose && <Fact label="Purpose / notes" value={v.purpose} />}
                </section>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
                <Fact label="Payee type" value={v.names.payee_type} />
                <Fact label="Voucher type" value={v.names.voucher_type} />
                <Fact label="Department" value={v.names.department} />
                <Fact label="Payment" value={PAYMENT_LABELS[v.payment_method] ?? v.payment_method} />
                {v.payment_method === 'bank' && (
                  <Fact
                    label="Bank"
                    value={[v.bank_name, v.bank_account_name, v.bank_account_number].filter(Boolean).join(' · ') || null}
                  />
                )}
                <Fact label="Reference" value={v.reference_number} />
                <Fact label="Due date" value={v.due_date ? formatDate(v.due_date, 'MMM d, yyyy') : null} />
                <Fact label="Priority" value={PRIORITY_LABELS[v.priority] ?? v.priority} />
              </section>

              <section className="flex flex-col gap-2.5 rounded-xl border bg-card px-4 py-3.5">
                <h2 className="text-card-title">Review history</h2>
                {v.history.length === 0 ? (
                  <p className="text-caption">
                    {v.submitted_at ? 'No reviewer has acted on it yet.' : 'Nothing yet: it hasn’t been submitted.'}
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {v.history.map((h, i) => {
                      const look = ACTION_LOOK[h.action] ?? ACTION_LOOK.noted
                      return (
                        <li key={i} className="flex gap-2.5">
                          <look.icon className={`mt-0.5 size-4 shrink-0 ${look.tone}`} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-body-strong">
                              {look.text} · step {h.step}
                            </p>
                            <p className="text-caption">
                              {h.by ?? 'A reviewer'}
                              {h.at && ` · ${formatTimeAgo(h.at)}`}
                            </p>
                            {h.remarks && <p className="text-body mt-1 rounded-lg bg-muted px-2.5 py-1.5">“{h.remarks}”</p>}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {confirmCancel && v && (
          <ConfirmDialog
            key="cancel"
            icon={{ icon: Ban, tone: 'danger' }}
            title="Cancel this voucher?"
            description={v.voucher_number ?? 'Draft voucher'}
            confirmLabel="Cancel voucher"
            tone="danger"
            busy={busy === 'cancel'}
            onConfirm={cancel}
            onCancel={() => setConfirmCancel(false)}
          >
            <p className="text-caption rounded-[10px] bg-muted px-3.5 py-3 text-foreground">
              It stays in your list as Cancelled, so the history is complete. It can't be submitted after that.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-caption">{label}</span>
      <span className="text-body whitespace-pre-line">{value || '—'}</span>
    </div>
  )
}

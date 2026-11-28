import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { FileDown, Loader2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { normalizeApiError } from '@/lib/apiError'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { downloadPaymentPdf, emailPayee, getVoucher } from '../api'
import { PAYMENT_LABELS } from '../utils'

/**
 * After the Supervisor's final approval (user decisions 2026-11-28): "Payment PDF" (cash slip / bank transfer advice /
 * cheque slip) and "Email the payee" (the approval + the PDF, to the payee's email on the voucher). Shown on the
 * approved voucher's page and on the clerk's final-approval notice.
 *   voucherId, canEmail (false = no payee email: the button is off with a note), size 'sm' | 'md'
 */
export default function PaymentActions({ voucherId, canEmail, size = 'md' }) {
  const [downloading, setDownloading] = useState(false)
  const [emailing, setEmailing] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      await downloadPaymentPdf(voucherId)
    } catch (error) {
      toast.error(normalizeApiError(error).message || 'Couldn’t make the payment PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const btn = cn(
    'flex items-center gap-1.5 rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
    size === 'sm' ? 'text-caption h-8 px-2.5 font-medium text-foreground' : 'text-body-strong h-[38px] px-3.5',
  )

  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={download} disabled={downloading} className={btn}>
          {downloading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="size-3.5" aria-hidden="true" />
          )}
          Payment PDF
        </button>
        <button
          type="button"
          onClick={() => setEmailing(true)}
          disabled={!canEmail}
          title={canEmail ? undefined : 'No payee email on this voucher. Download the PDF and send it yourself.'}
          className={btn}
        >
          <Mail className="size-3.5" aria-hidden="true" /> Email the payee
        </button>
        {!canEmail && size === 'md' && <span className="text-caption">No payee email on this voucher.</span>}
      </span>
      <AnimatePresence>{emailing && <EmailPayeeDialog voucherId={voucherId} onClose={() => setEmailing(false)} />}</AnimatePresence>
    </>
  )
}

/** Confirms who gets the email (loads the voucher), with an optional note from the clerk. */
function EmailPayeeDialog({ voucherId, onClose }) {
  const [voucher, setVoucher] = useState({ status: 'loading', data: null, error: null })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getVoucher(voucherId)
      .then((data) => !cancelled && setVoucher({ status: 'ready', data, error: null }))
      .catch((err) => !cancelled && setVoucher({ status: 'error', data: null, error: normalizeApiError(err) }))
    return () => {
      cancelled = true
    }
  }, [voucherId])

  const v = voucher.data

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await emailPayee(voucherId, note.trim())
      toast.success(`Sent to ${r.sent_to}, with the payment PDF attached.`)
      onClose()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title="Email the payee?"
      description={v ? `${v.voucher_number} · ${v.payee_name ?? 'Payee'}` : undefined}
      icon={{ icon: Mail, tone: 'primary' }}
      confirmLabel="Send email"
      confirmDisabled={voucher.status !== 'ready' || !v?.payee_email}
      busy={busy}
      error={error}
      onConfirm={send}
      onCancel={onClose}
      width={500}
    >
      {voucher.status === 'loading' && (
        <p role="status" className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading the voucher…
        </p>
      )}
      {voucher.status === 'error' && (
        <p className="text-danger">
          {voucher.error.status === 404
            ? 'This voucher isn’t in the company you’re working in now. Switch to its company and try again.'
            : voucher.error.message}
        </p>
      )}
      {v && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[10px] bg-muted px-3.5 py-3">
            <dt className="text-caption">To</dt>
            <dd className="text-body-strong break-all">{v.payee_email ?? 'No email on this voucher'}</dd>
            <dt className="text-caption">Amount</dt>
            <dd className="text-body">{formatMoney(v.amount)}</dd>
            <dt className="text-caption">Payment</dt>
            <dd className="text-body">{PAYMENT_LABELS[v.payment_method] ?? v.payment_method}</dd>
          </dl>
          <p className="text-caption">
            They get “your payment was approved” with the payment PDF attached. A bank account number is shown with its last 4 digits only.
          </p>
          <FieldShell id="payee-note" label="Note (optional)" hint="Added to the email, e.g. when to expect the payment.">
            <textarea
              id="payee-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={busy}
              placeholder="e.g. The cheque is ready for pick-up on Friday."
              className={cn(inputClass, 'h-auto resize-y py-2')}
            />
          </FieldShell>
        </div>
      )}
    </ConfirmDialog>
  )
}

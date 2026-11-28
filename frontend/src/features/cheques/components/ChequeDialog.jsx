import { useState } from 'react'
import { format } from 'date-fns'
import { Ban, BadgeCheck, HandCoins, NotebookPen } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { normalizeApiError } from '@/lib/apiError'
import { formatDate, formatMoney } from '@/lib/formatters'
import { moveCheque, recordCheque } from '../api'

const today = () => format(new Date(), 'yyyy-MM-dd')

/**
 * One dialog for every cheque step (cheque register, 2026-11-29):
 *   mode 'record'  cheque no. + cheque date + bank      (voucher = { id, number, amount, payee_name })
 *   mode 'release' who picked it up                      (cheque)
 *   mode 'clear'   the day the bank paid it              (cheque)
 *   mode 'cancel'  why (spoiled, lost, wrong amount…)    (cheque)
 * Server 422s show under the fields; other errors (409 "already recorded" / "status changed") inside the dialog.
 * onDone(cheque) after a success; onClose() to close.
 */
export default function ChequeDialog({ mode, voucher, cheque, onDone, onClose }) {
  const [form, setForm] = useState(() => ({
    cheque_number: '',
    cheque_date: today(),
    bank_name: '',
    received_by: cheque?.payee_name ?? '',
    cleared_on: today(),
    reason: '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const fieldError = (key) => error?.errors?.[key]?.[0]

  const config = {
    record: {
      title: 'Record the cheque',
      description: `${voucher?.number ?? ''} · ${formatMoney(voucher?.amount)} to ${voucher?.payee_name ?? 'the payee'}`,
      confirm: 'Record cheque',
      icon: { icon: NotebookPen, tone: 'primary' },
      tone: 'primary',
      fields: ['cheque_number', 'cheque_date', 'bank_name'],
      success: 'Cheque recorded. The payment PDF now shows it.',
    },
    release: {
      title: `Release cheque ${cheque?.cheque_number ?? ''}?`,
      description: 'Mark it as handed over to the payee.',
      confirm: 'Mark released',
      icon: { icon: HandCoins, tone: 'warning' },
      tone: 'primary',
      fields: ['received_by'],
      success: 'Cheque marked released.',
    },
    clear: {
      title: `Mark cheque ${cheque?.cheque_number ?? ''} cleared?`,
      description: 'Use the date the amount left the company’s bank account (see the bank statement).',
      confirm: 'Mark cleared',
      icon: { icon: BadgeCheck, tone: 'success' },
      tone: 'success',
      fields: ['cleared_on'],
      success: 'Cheque marked cleared.',
    },
    cancel: {
      title: `Cancel cheque ${cheque?.cheque_number ?? ''}?`,
      description: 'Write “CANCELLED” across the paper cheque and keep it. You can record a replacement cheque afterwards.',
      confirm: 'Cancel cheque',
      icon: { icon: Ban, tone: 'danger' },
      tone: 'danger',
      fields: ['reason'],
      success: 'Cheque cancelled. You can record a replacement on the voucher.',
    },
  }[mode]

  const submit = async () => {
    setBusy(true)
    setError(null)
    const body = Object.fromEntries(config.fields.map((k) => [k, form[k]]))
    try {
      const saved = mode === 'record' ? await recordCheque(voucher.id, body) : await moveCheque(cheque.id, mode, body)
      toast.success(config.success)
      onDone?.(saved)
      onClose()
    } catch (err) {
      setError(normalizeApiError(err))
    } finally {
      setBusy(false)
    }
  }

  // the general error box only when it isn't a field error already shown under a field
  const boxError = error && !config.fields.some((k) => fieldError(k)) ? error : null

  return (
    <ConfirmDialog
      title={config.title}
      description={config.description}
      icon={config.icon}
      confirmLabel={config.confirm}
      cancelLabel={mode === 'cancel' ? 'Keep cheque' : 'Cancel'}
      tone={config.tone}
      busy={busy}
      error={boxError}
      width={480}
      onConfirm={submit}
      onCancel={onClose}
    >
      {mode === 'record' && (
        <>
          <FieldShell id="cheque-number" label="Cheque no." required error={fieldError('cheque_number')} hint="As printed on the cheque">
            <input
              id="cheque-number"
              value={form.cheque_number}
              onChange={set('cheque_number')}
              className={inputClass}
              aria-invalid={Boolean(fieldError('cheque_number'))}
              autoFocus
              inputMode="numeric"
              maxLength={30}
            />
          </FieldShell>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldShell
              id="cheque-date"
              label="Cheque date"
              required
              error={fieldError('cheque_date')}
              hint="Post-dated is fine (up to 180 days)"
            >
              <input
                id="cheque-date"
                type="date"
                value={form.cheque_date}
                onChange={set('cheque_date')}
                className={inputClass}
                aria-invalid={Boolean(fieldError('cheque_date'))}
              />
            </FieldShell>
            <FieldShell id="cheque-bank" label="Bank" required error={fieldError('bank_name')} hint="The bank the cheque is drawn on">
              <input
                id="cheque-bank"
                value={form.bank_name}
                onChange={set('bank_name')}
                className={inputClass}
                aria-invalid={Boolean(fieldError('bank_name'))}
                placeholder="e.g. BDO"
                maxLength={150}
              />
            </FieldShell>
          </div>
          <p className="text-caption">A cheque goes stale 180 days after its date. You’ll get a reminder 30 days before.</p>
        </>
      )}

      {mode === 'release' && (
        <FieldShell id="received-by" label="Received by" required error={fieldError('received_by')} hint="The person who picked it up">
          <input
            id="received-by"
            value={form.received_by}
            onChange={set('received_by')}
            className={inputClass}
            aria-invalid={Boolean(fieldError('received_by'))}
            autoFocus
            maxLength={150}
          />
        </FieldShell>
      )}

      {mode === 'clear' && (
        <>
          <FieldShell id="cleared-on" label="Cleared on" required error={fieldError('cleared_on')}>
            <input
              id="cleared-on"
              type="date"
              value={form.cleared_on}
              max={today()}
              onChange={set('cleared_on')}
              className={inputClass}
              aria-invalid={Boolean(fieldError('cleared_on'))}
            />
          </FieldShell>
          {cheque?.cheque_date && <p className="text-caption">Cheque date: {formatDate(cheque.cheque_date, 'MMM d, yyyy')}</p>}
        </>
      )}

      {mode === 'cancel' && (
        <FieldShell id="cancel-reason" label="Reason" required error={fieldError('reason')}>
          <input
            id="cancel-reason"
            value={form.reason}
            onChange={set('reason')}
            className={inputClass}
            aria-invalid={Boolean(fieldError('reason'))}
            placeholder="e.g. Spoiled while writing"
            autoFocus
            maxLength={255}
          />
        </FieldShell>
      )}
    </ConfirmDialog>
  )
}

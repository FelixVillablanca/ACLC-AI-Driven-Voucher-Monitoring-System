import { useState } from 'react'
import { Check, ChevronDown, TriangleAlert, Undo2, X } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { finalApprove, rejectLevel2, returnLevel2 } from '../api'
import { shortName } from '../utils'

/**
 * The Supervisor's three decision windows (2026-11-27). Each sends its request itself and calls onDone(result) on
 * success; errors stay inside the window (422 → under the fields, others on top), except "someone already decided"
 * (409 VOUCHER_ALREADY_REVIEWED) → onConflict(error).
 *   Final approve (Framer WQL6Ca1ML): last step, can't be undone; overriding a flag / going over budget is spelled
 *                 out; remarks required when the voucher is flagged.
 *   Return (Framer PlbU6CVEj): back to Accounting (the Level 1 approver) or to the clerk + what needs fixing + remarks.
 *   Reject (Framer tW_30cpOE): reason + remarks; closed for good.
 * Code differs from the frames: the "needs fixing" tags are the shared list (no "Missing quotation": no attachments yet).
 */

export function FinalApproveDialog({ voucher, initialRemarks, onDone, onCancel, onConflict }) {
  const flagged = voucher.ai.flagged
  const budget = voucher.review.budget
  const over = budget?.over_by
  const [remarks, setRemarks] = useState(initialRemarks ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  const confirm = async () => {
    if (flagged && remarks.trim().length < 5) {
      setFieldError('This voucher is flagged: say why you approve it anyway (at least 5 characters).')
      return
    }
    setFieldError(null)
    setBusy(true)
    setError(null)
    try {
      onDone(await finalApprove(voucher.id, remarks.trim()))
    } catch (e) {
      if (e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      if (e.errors?.remarks) setFieldError(e.errors.remarks[0])
      else setError(e)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      width={500}
      tone="success"
      icon={{ icon: Check, tone: 'success' }}
      title={`Give final approval to ${voucher.voucher_number}?`}
      confirmLabel="✓ Approve & release"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">
        {formatMoney(voucher.amount)} to {voucher.payee_name ?? 'the payee'} will be released for payment. This is the last approval step
        and can’t be undone.
      </p>
      {(flagged || over) && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            {flagged && <p className="text-badge text-warning">You’re overriding a flag from the automatic check</p>}
            <p className="text-caption text-foreground">
              {over
                ? `${voucher.names?.department ?? 'The department'} will go ${formatMoney(over)} over its ${budget.period} budget. `
                : ''}
              Your remarks are saved to the audit trail.
            </p>
          </div>
        </div>
      )}
      <Field id="l2-approve-remarks" label="Remarks" required={flagged} error={fieldError}>
        <textarea
          id="l2-approve-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          aria-invalid={fieldError ? true : undefined}
          placeholder={
            flagged ? 'e.g. Laptops replace 6 units past warranty. Budget top-up approved separately.' : 'Anything worth noting (optional)'
          }
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </Field>
    </ConfirmDialog>
  )
}

export function Level2ReturnDialog({ voucher, options, initialRemarks, onDone, onCancel, onConflict }) {
  const level1 = voucher.review.level1
  const [sendTo, setSendTo] = useState('accounting')
  const [tags, setTags] = useState([])
  const [remarks, setRemarks] = useState(initialRemarks ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const toggle = (key) => setTags((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]))

  const confirm = async () => {
    const next = {}
    if (tags.length === 0) next.needs_changes = 'Pick at least one thing that needs fixing.'
    if (remarks.trim().length < 5)
      next.remarks = remarks.trim() ? 'Write a little more (at least 5 characters).' : 'Say exactly what to fix.'
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      onDone(await returnLevel2(voucher.id, sendTo, tags, remarks.trim()))
    } catch (e) {
      if (e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      if (e.errors)
        setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k.startsWith('needs_changes') ? 'needs_changes' : k, v[0]])))
      else setError(e)
      setBusy(false)
    }
  }

  const targets = [
    {
      key: 'accounting',
      label: `Accounting · ${level1?.by ? shortName(level1.by) : 'Level 1'}`,
      hint: 'Back to the review queue at Level 1',
    },
    { key: 'clerk', label: `Clerk · ${shortName(voucher.clerk?.name)}`, hint: 'The clerk fixes it and resubmits' },
  ]

  return (
    <ConfirmDialog
      width={540}
      tone="warning"
      icon={{ icon: Undo2, tone: 'warning' }}
      title={`Return ${voucher.voucher_number}`}
      description="The voucher goes back for changes. It stays open and comes back to you after it’s fixed."
      confirmLabel="↩ Return voucher"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-label text-foreground">Send back to</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Send back to">
          {targets.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={sendTo === t.key}
              disabled={busy}
              onClick={() => setSendTo(t.key)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                sendTo === t.key ? 'border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
              )}
            >
              <span className={cn('text-body-strong', sendTo === t.key && 'text-primary')}>{t.label}</span>
              <span className="text-caption">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-label text-foreground">
          What needs fixing <span className="text-danger">*</span>
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="What needs fixing">
          {(options?.needs_changes ?? []).map((t) => {
            const on = tags.includes(t.key)
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => toggle(t.key)}
                className={cn(
                  'h-8 rounded-lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  on
                    ? 'text-auth-button bg-primary text-primary-foreground'
                    : 'text-body-strong border bg-card text-foreground hover:bg-muted',
                )}
              >
                {on ? '✓ ' : '+ '}
                {t.label}
              </button>
            )
          })}
        </div>
        {errors.needs_changes && <p className="text-caption text-danger">{errors.needs_changes}</p>}
      </div>
      <Field id="l2-return-remarks" label="Remarks" required error={errors.remarks || errors.send_to}>
        <textarea
          id="l2-return-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          aria-invalid={errors.remarks ? true : undefined}
          placeholder="e.g. Please request a ₱72,000 IT budget top-up before resubmitting."
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </Field>
      <p className="text-caption">
        {sendTo === 'clerk'
          ? `${shortName(voucher.clerk?.name)} gets an email and a notification; Accounting is told too.`
          : `${level1?.by ?? 'Accounting'} gets a notification and finds it back in the review queue.`}
      </p>
    </ConfirmDialog>
  )
}

export function Level2RejectDialog({ voucher, options, initialRemarks, onDone, onCancel, onConflict }) {
  const [reason, setReason] = useState('')
  const [remarks, setRemarks] = useState(initialRemarks ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})

  const confirm = async () => {
    const next = {}
    if (!reason) next.reason = 'Choose a reason.'
    if (remarks.trim().length < 5)
      next.remarks = remarks.trim() ? 'Write a little more (at least 5 characters).' : 'Remarks are required to reject.'
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      onDone(await rejectLevel2(voucher.id, reason, remarks.trim()))
    } catch (e) {
      if (e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      if (e.errors) setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else setError(e)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      width={480}
      tone="danger"
      icon={{ icon: X, tone: 'danger' }}
      title={`Reject ${voucher.voucher_number}?`}
      confirmLabel="✕ Reject voucher"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">
        The voucher will be closed and can’t be resubmitted. The clerk and the Level 1 approver are notified.
      </p>
      <Field id="l2-reason" label="Reason" required error={errors.reason}>
        <div className="relative">
          <select
            id="l2-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            aria-invalid={errors.reason ? true : undefined}
            className={cn(inputClass, 'appearance-none pr-9')}
          >
            <option value="">Choose…</option>
            {(options?.reject_reasons ?? []).map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </Field>
      <Field id="l2-reject-remarks" label="Remarks" required error={errors.remarks}>
        <textarea
          id="l2-reject-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          aria-invalid={errors.remarks ? true : undefined}
          placeholder="e.g. IT budget is exhausted for FY 2026. Re-file in January under the new allocation."
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </Field>
    </ConfirmDialog>
  )
}

function Field({ id, label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  )
}

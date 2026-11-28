import { useState } from 'react'
import { Check, ChevronDown, Undo2, X } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { approveVoucher, rejectVoucher, returnVoucher } from '../api'
import { STEP2_REASON_TEXT, supervisorNames } from '../utils'

/**
 * The three decision windows on the review page. Each sends its request itself and calls
 * onDone(result) on success; errors stay inside the window (422 → under the fields, others on top),
 * except "another officer decided first" (409 VOUCHER_ALREADY_REVIEWED) → onConflict(error).
 *   Approve (Framer pzSaaMGhY): what happens next follows the routing rule; optional note.
 *   Return  (Framer XT9f8T3lY): what needs changes (1+) + remarks for the clerk, both required.
 *   Reject  (Framer sozCOjfDk): reason + remarks, both required; rejected vouchers are closed.
 * Code differs from the frames: no "within 5 business days" (no resubmit deadline, user decision), and no
 * "Attachments" tag (clerks can't upload files yet).
 */

export function ApproveDialog({ voucher, initialRemarks, onDone, onCancel, onConflict, aiFinding = null }) {
  const reasons = voucher.review.step2_reasons
  const forward = reasons.length > 0
  const sups = voucher.review.supervisors
  const [remarks, setRemarks] = useState(initialRemarks ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await approveVoucher(voucher.id, remarks.trim(), aiFinding))
    } catch (e) {
      if (e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      setError(e)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      width={480}
      tone="success"
      icon={{ icon: Check, tone: 'success' }}
      title={`Approve ${voucher.voucher_number}?`}
      confirmLabel={forward ? 'Approve & forward' : 'Approve'}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">
        {formatMoney(voucher.amount)} to {voucher.payee_name ?? 'the payee'} will be marked approved at Level 1.
        {forward
          ? ` It will be forwarded to ${supervisorNames(sups)} (Supervisor / Manager) for the final approval: every voucher needs it.${
              reasons.filter((r) => r !== 'every_voucher').length
                ? ` It’s marked for them because ${reasons
                    .filter((r) => r !== 'every_voucher')
                    .map((r) => STEP2_REASON_TEXT[r])
                    .join(' and ')}.`
                : ''
            }`
          : ' Your approval is final: it doesn’t need the Supervisor.'}
      </p>
      {forward && sups.length === 0 && (
        <p className="text-caption rounded-lg bg-warning-soft px-3 py-2 text-foreground">
          Nobody in this company is a Supervisor / Manager yet, so it will wait with the Supervisor until one is added.
        </p>
      )}
      <Field id="d-remarks" label={forward ? 'Note to Supervisor (optional)' : 'Remarks (optional)'} error={error?.errors?.remarks?.[0]}>
        <textarea
          id="d-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          placeholder={forward ? 'e.g. Checked against APX-2026-0391: different billing period.' : 'Anything worth noting'}
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </Field>
    </ConfirmDialog>
  )
}

export function ReturnDialog({ voucher, options, initialRemarks, onDone, onCancel, onConflict, aiFinding = null }) {
  const [tags, setTags] = useState([])
  const [remarks, setRemarks] = useState(initialRemarks ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const first = voucher.clerk?.name?.split(' ')[0] ?? 'The clerk'

  const toggle = (key) => setTags((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]))

  const confirm = async () => {
    const next = {}
    if (tags.length === 0) next.needs_changes = 'Pick at least one thing the clerk needs to change.'
    if (remarks.trim().length < 5)
      next.remarks = remarks.trim() ? 'Write a little more so the clerk knows what to do.' : 'Tell the clerk exactly what to fix.'
    setErrors(next)
    setError(null)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      onDone(await returnVoucher(voucher.id, tags, remarks.trim(), aiFinding))
    } catch (e) {
      if (e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      if (e.errors)
        setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k.startsWith('needs_changes') ? 'needs_changes' : k, v[0]])))
      else setError(e)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      width={520}
      tone="warning"
      icon={{ icon: Undo2, tone: 'warning' }}
      title={`Return ${voucher.voucher_number} to ${voucher.clerk?.name ?? 'the clerk'}?`}
      confirmLabel="↩ Return to clerk"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">The clerk can edit and resubmit it; it keeps its number. Tell them exactly what to fix.</p>
      <div className="flex flex-col gap-1.5">
        <p className="text-label text-foreground">
          What needs changes? <span className="text-danger">*</span>
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="What needs changes">
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
                {on && '✓ '}
                {t.label}
              </button>
            )
          })}
        </div>
        {errors.needs_changes && <p className="text-caption text-danger">{errors.needs_changes}</p>}
      </div>
      <Field id="d-return-remarks" label="Remarks for the clerk" required error={errors.remarks}>
        <textarea
          id="d-return-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          aria-invalid={errors.remarks ? true : undefined}
          placeholder="e.g. Please split the airport transfer into its own line."
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </Field>
      <p className="text-caption">{first} will get an email and an in-app notification.</p>
    </ConfirmDialog>
  )
}

export function RejectDialog({ voucher, options, initialRemarks, onDone, onCancel, onConflict }) {
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
      onDone(await rejectVoucher(voucher.id, reason, remarks.trim()))
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
      confirmLabel="Reject voucher"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">
        Rejected vouchers are closed and can’t be resubmitted. Use “Return” instead if the clerk only needs to fix something.
      </p>
      <Field id="d-reason" label="Reason" required error={errors.reason}>
        <div className="relative">
          <select
            id="d-reason"
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
      <Field id="d-reject-remarks" label="Remarks" required error={errors.remarks}>
        <textarea
          id="d-reject-remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={busy}
          aria-invalid={errors.remarks ? true : undefined}
          placeholder="Explain why this voucher is rejected…"
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

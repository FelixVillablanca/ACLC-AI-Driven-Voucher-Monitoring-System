import { useState } from 'react'
import { Check, Loader2, TriangleAlert, X } from 'lucide-react'
import ModalShell from '@/components/common/ModalShell'
import { inputClass } from '@/components/common/FieldShell'
import { fromCentavos, moneyText, normalizeMoney, pctText, toCentavos } from '@/features/budgets'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { approveBudgetChange, declineBudgetChange } from '../api'
import { outlineBtn, primaryBtn } from '../utils'

const CONFLICTS = ['REQUEST_ALREADY_DECIDED', 'BUDGET_CHANGED']

/**
 * Sign off (or decline) one of Accounting's budget changes (Framer KHqkVA77a "Approve budget top-up"), 2026-11-27.
 *   approve  current budget → after the change (with how much of it is used), the stored forecast when there is one,
 *            the officer's reason, "Approved top-up" (any amount up to what was asked; changes that lower the budget
 *            are approved as asked), optional remarks.
 *   decline  a reason is required (Accounting is told).
 * Calls onDone(message) on success; 409 (already decided / the budget moved) → onConflict(error); other errors stay here.
 * Code differs from the frame: the ✦ AI box is the stored forecast (linear trend until the ML model), shown only when
 * one exists; the request's own reason is shown too.
 */
export default function BudgetChangeDialog({ request: r, initialMode = 'approve', onDone, onConflict, onClose }) {
  const [mode, setMode] = useState(initialMode)
  const change = toCentavos(r.change.replace('-', '')) * (r.change.startsWith('-') ? -1 : 1)
  const up = change > 0
  const [amount, setAmount] = useState(up ? moneyText(fromCentavos(change)) : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState({})
  const moved = r.budget_now !== r.current_budget
  const blocked = r.mine || moved

  const typed = normalizeMoney(amount)
  const approvedCents = up ? (typed ? toCentavos(r.current_budget) + toCentavos(typed) : null) : toCentavos(r.requested_budget)
  const usedCents = toCentavos(r.used)
  const afterPct = approvedCents ? (usedCents / approvedCents) * 100 : null

  const run = async (fn, message) => {
    setBusy(true)
    setError(null)
    setFields({})
    try {
      await fn()
      onDone(message)
    } catch (e) {
      if (CONFLICTS.includes(e.code)) return onConflict(e)
      if (e.errors) setFields(Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]])))
      else setError(e)
      setBusy(false)
    }
  }

  const approve = () => {
    if (up) {
      if (!typed || toCentavos(typed) <= 0) return setFields({ approved_budget: 'Enter the top-up you approve, more than ₱0.00.' })
      if (toCentavos(typed) > change) return setFields({ approved_budget: `At most the ${formatMoney(fromCentavos(change))} asked for.` })
    }
    run(
      () => approveBudgetChange(r.id, fromCentavos(approvedCents), note.trim()),
      `${r.department.name}: budget is now ${formatMoney(fromCentavos(approvedCents))}. Accounting was told.`,
    )
  }
  const decline = () => {
    if (note.trim().length < 3) return setFields({ note: 'Tell Accounting why you are declining this change.' })
    run(() => declineBudgetChange(r.id, note.trim()), `${r.department.name}: change declined. Accounting was told.`)
  }

  const title =
    mode === 'decline'
      ? `Decline budget change · ${r.department.name}`
      : `Approve budget ${up ? 'top-up' : 'change'} · ${r.department.name}`

  return (
    <ModalShell
      title={title}
      subtitle={`${r.fiscal_label} · asked by ${r.requested_by ?? 'Accounting'}`}
      width={560}
      onClose={() => !busy && onClose()}
      keepOpenOnBackdrop={busy || !!note}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        {error && (
          <p role="alert" className="text-body rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-danger">
            {error.message}
            {error.requestId && <span className="text-caption block">Request ID {error.requestId}</span>}
          </p>
        )}
        {blocked && (
          <p className="text-body flex gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            {r.mine
              ? 'You asked for this change, so another Supervisor has to decide on it.'
              : `This budget changed to ${formatMoney(r.budget_now)} after the request was made. Decline it and ask Accounting to send a new one.`}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5 rounded-lg border bg-muted px-3.5 py-3">
            <span className="text-caption">Current budget</span>
            <span className="text-card-title tabular-nums">{formatMoney(r.current_budget)}</span>
            <span className="text-caption">{pctText(r.used_pct)} used</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg border border-primary/30 bg-primary-faint px-3.5 py-3">
            <span className="text-caption">{mode === 'decline' ? 'Asked for' : up ? 'After top-up' : 'After the change'}</span>
            <span className="text-card-title tabular-nums">
              {mode === 'decline' ? formatMoney(r.requested_budget) : approvedCents ? formatMoney(fromCentavos(approvedCents)) : '—'}
            </span>
            <span className="text-caption">
              {mode === 'decline'
                ? `${pctText(r.after_pct)} used`
                : afterPct === null
                  ? ' '
                  : `${pctText(Math.round(afterPct * 10) / 10)} used`}
            </span>
          </div>
        </div>
        {r.requested_alert_pct !== r.current_alert_pct && (
          <p className="text-caption">
            The alert level also changes: {pctText(r.current_alert_pct)} → {pctText(r.requested_alert_pct)}.
          </p>
        )}

        <blockquote className="text-body rounded-lg border-l-4 border-primary/40 bg-muted px-3.5 py-2.5">
          “{r.reason}”<span className="text-caption block">{r.requested_by ?? 'Accounting'}</span>
        </blockquote>

        {r.forecast && mode === 'approve' && <ForecastNote forecast={r.forecast} used={r.used} approvedCents={approvedCents} />}

        {mode === 'approve' && up && (
          <Field
            id="topup-amount"
            label="Approved top-up"
            error={fields.approved_budget}
            hint={`Up to ${formatMoney(fromCentavos(change))}, as asked.`}
          >
            <div className="relative">
              <span className="text-body pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
              <input
                id="topup-amount"
                inputMode="decimal"
                value={amount}
                disabled={busy || blocked}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => typed && setAmount(moneyText(typed))}
                aria-invalid={fields.approved_budget ? true : undefined}
                className={cn(inputClass, 'pl-7 tabular-nums')}
              />
            </div>
          </Field>
        )}

        <Field
          id="topup-note"
          label={mode === 'decline' ? 'Why are you declining?' : 'Remarks'}
          required={mode === 'decline'}
          error={fields.note}
          hint={mode === 'decline' ? 'Accounting sees this.' : 'Optional. Accounting sees this.'}
        >
          <textarea
            id="topup-note"
            rows={3}
            maxLength={500}
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={fields.note ? true : undefined}
            placeholder={
              mode === 'decline' ? 'e.g. No approved plan on file.' : 'e.g. Approved from Finance contingency. Revisit in January.'
            }
            className={cn(inputClass, 'h-auto resize-y py-2')}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        {mode === 'approve' ? (
          <>
            <button type="button" disabled={busy} onClick={() => setMode('decline')} className={cn(outlineBtn, 'text-danger')}>
              <X className="size-4" aria-hidden="true" /> Decline
            </button>
            <button type="button" disabled={busy || blocked} onClick={approve} className={primaryBtn}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              {busy ? 'Approving…' : up ? 'Approve top-up' : 'Approve change'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => (initialMode === 'decline' ? onClose() : setMode('approve'))}
              className={outlineBtn}
            >
              {initialMode === 'decline' ? 'Cancel' : 'Back'}
            </button>
            <button
              type="button"
              disabled={busy || r.mine}
              onClick={decline}
              className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-danger px-4 text-white outline-none hover:bg-danger/90 focus-visible:ring-3 focus-visible:ring-danger/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
              {busy ? 'Declining…' : 'Decline change'}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}

/** "The forecast expects about ₱204,000 more through December 2026. After this change ₱… would be left: enough / ₱… short." */
function ForecastNote({ forecast, used, approvedCents }) {
  const expected = toCentavos(forecast.expected)
  const left = approvedCents === null ? null : approvedCents - toCentavos(used)
  const short = left !== null && expected > left ? expected - left : 0
  return (
    <div
      className={cn(
        'text-body rounded-lg border px-3.5 py-2.5',
        short ? 'border-warning/40 bg-warning-soft' : 'border-success/30 bg-success-soft',
      )}
    >
      <span className="text-badge mr-1.5 text-primary">Forecast</span>
      About {formatMoney(forecast.expected)} more is expected through {forecast.until}.{' '}
      {left === null
        ? ''
        : short
          ? `After this change ${formatMoney(fromCentavos(Math.max(0, left)))} would be left: ${formatMoney(fromCentavos(short))} short.`
          : `After this change ${formatMoney(fromCentavos(left))} would be left: enough for it.`}
    </div>
  )
}

function Field({ id, label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-caption">{hint}</p>
      )}
    </div>
  )
}

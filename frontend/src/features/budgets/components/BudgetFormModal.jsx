import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Info, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { allocateBudget, updateBudget } from '../api'
import { ALERT_MAX, ALERT_MIN, announceBudgetsChanged, fromCentavos, moneyText, normalizeMoney, pctText, toCentavos } from '../utils'

const schema = (editing) =>
  z.object({
    department_id: editing ? z.any() : z.string().min(1, 'Pick a department.'),
    total: z
      .string()
      .refine((v) => normalizeMoney(v) !== null, 'Type an amount like 1,500,000.00')
      .refine((v) => toCentavos(normalizeMoney(v) ?? '0') >= 100, 'The budget must be at least ₱1.00'),
    alert: z.coerce
      .number()
      .min(ALERT_MIN, `Between ${ALERT_MIN}% and ${ALERT_MAX}%`)
      .max(ALERT_MAX, `Between ${ALERT_MIN}% and ${ALERT_MAX}%`),
    reason: editing ? z.string().trim().min(5, 'Say why the budget changes (at least 5 characters).').max(500) : z.string().max(500),
  })

/**
 * EDIT ALLOCATION (Framer MGf9CXv2s) and "+ Allocate budget" (same form, create mode), 2026-11-27.
 *   edit:   budget = { id, total, used, alert_pct } of `department`; shows current → new, what it does to usage,
 *           and whether it needs a Supervisor's sign-off (a change bigger than `signoffAbove`).
 *   create: departments = [{ id, name }] without a budget for `year`.
 * Code differs from the frame: no "Covers AI-forecast gap" (no forecasting model yet).
 * Success: toast + onSaved(). 409s (someone else changed it, a request is already waiting) are shown in the
 * dialog with what to do; 422s go under the fields.
 */
export default function BudgetFormModal({
  mode,
  department,
  budget,
  departments = [],
  year,
  yearLabel,
  signoffAbove,
  initialTotal = null, // pre-filled new amount, e.g. the Forecasts "Apply top-up" (Framer sjtX1kKqt)
  initialReason = '',
  onClose,
  onSaved,
}) {
  const editing = mode === 'edit'
  const [formError, setFormError] = useState(null)
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema(editing)),
    defaultValues: {
      department_id: department ? String(department.id) : '',
      total: initialTotal ? moneyText(initialTotal) : editing ? moneyText(budget.total) : '',
      alert: editing ? budget.alert_pct : 85,
      reason: initialReason,
    },
  })
  const [total, alert, deptId] = useWatch({ control, name: ['total', 'alert', 'department_id'] })

  const newMoney = normalizeMoney(total)
  const newC = newMoney ? toCentavos(newMoney) : null
  const oldC = editing ? toCentavos(budget.total) : 0
  const usedC = editing ? toCentavos(budget.used) : 0
  const diffC = newC === null ? 0 : newC - oldC
  const needsSignoff = editing && Math.abs(diffC) > toCentavos(signoffAbove)
  const newPct = newC ? (usedC / newC) * 100 : null
  const deptName = editing ? department.name : departments.find((d) => String(d.id) === deptId)?.name

  const save = handleSubmit(async (values) => {
    setFormError(null)
    try {
      if (editing) {
        const res = await updateBudget(budget.id, {
          total_budget: normalizeMoney(values.total),
          alert_threshold_pct: Number(values.alert),
          reason: values.reason.trim(),
          was_total: budget.total,
          was_alert_pct: budget.alert_pct,
        })
        toast.success(
          res.applied
            ? `${department.name}'s ${yearLabel} budget was saved.`
            : `Sent to the Supervisor for sign-off. The budget stays ${formatMoney(budget.total)} until it's approved.`,
          { duration: res.applied ? 4000 : 7000 },
        )
      } else {
        await allocateBudget({
          department_id: Number(values.department_id),
          fiscal_year: year,
          total_budget: normalizeMoney(values.total),
          alert_threshold_pct: Number(values.alert),
          reason: values.reason.trim() || null,
        })
        toast.success(`${deptName ?? 'The department'} now has a ${yearLabel} budget of ${formatMoney(normalizeMoney(values.total))}.`)
      }
      announceBudgetsChanged()
      onSaved()
    } catch (error) {
      if (error.errors) {
        const map = { total_budget: 'total', alert_threshold_pct: 'alert', department_id: 'department_id', reason: 'reason' }
        Object.entries(error.errors).forEach(([field, messages], i) =>
          map[field] ? setError(map[field], { type: 'server', message: messages[0] }, { shouldFocus: i === 0 }) : setFormError(error),
        )
        return
      }
      if (['BUDGET_CHANGED', 'BUDGET_EXISTS', 'BUDGET_REQUEST_PENDING'].includes(error.code)) announceBudgetsChanged()
      setFormError(error)
    }
  })

  const alertNum = Number(alert) || 0

  return (
    <ModalShell
      title={editing ? `Edit allocation · ${department.name}` : 'Allocate budget'}
      subtitle={
        editing
          ? `${yearLabel} · changes are logged and need Supervisor sign-off above ${formatMoney(signoffAbove)}`
          : `${yearLabel} · one yearly budget per department`
      }
      width={500}
      onClose={onClose}
      keepOpenOnBackdrop={isDirty}
    >
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {!editing && (
            <FieldShell id="b-dept" label="Department" required error={errors.department_id?.message}>
              <div className="relative">
                <select
                  id="b-dept"
                  {...register('department_id')}
                  aria-invalid={errors.department_id ? true : undefined}
                  disabled={isSubmitting}
                  className={cn(inputClass, 'appearance-none pr-8')}
                >
                  <option value="">Choose a department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </FieldShell>
          )}

          <div className={cn('grid gap-3', editing && 'sm:grid-cols-2')}>
            {editing && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-label">Current allocation</span>
                <span className="text-body flex h-10 items-center rounded-lg border bg-muted px-3 tabular-nums">
                  {formatMoney(budget.total)}
                </span>
              </div>
            )}
            <FieldShell id="b-total" label={editing ? 'New allocation' : 'Budget for the year'} required error={errors.total?.message}>
              <div className="relative">
                <span className="text-body pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">₱</span>
                <input
                  id="b-total"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  {...register('total', {
                    onBlur: (e) => normalizeMoney(e.target.value) && setValue('total', moneyText(normalizeMoney(e.target.value))),
                  })}
                  aria-invalid={errors.total ? true : undefined}
                  disabled={isSubmitting}
                  className={cn(inputClass, 'pl-7 tabular-nums', editing && 'bg-primary-faint')}
                />
              </div>
            </FieldShell>
          </div>

          {editing && newC !== null && diffC !== 0 && (
            <div
              className={cn(
                'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5',
                diffC > 0 ? 'border-success/30 bg-success-soft' : 'border-warning/30 bg-warning-soft',
              )}
            >
              <span className={cn('text-badge', diffC > 0 ? 'text-success' : 'text-warning')}>
                {diffC > 0 ? '+' : '−'} {formatMoney(fromCentavos(Math.abs(diffC)))} · usage {diffC > 0 ? 'drops' : 'rises'} to{' '}
                {pctText(Math.round((newPct ?? 0) * 10) / 10)}
              </span>
              <span className="text-caption">
                Used so far: {formatMoney(budget.used)} ({pctText(budget.used_pct)} of the current budget)
              </span>
            </div>
          )}

          {needsSignoff && (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5" role="status">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-caption text-foreground">
                This changes the budget by more than {formatMoney(signoffAbove)}, so it goes to a{' '}
                <strong className="font-semibold">Supervisor / Manager for sign-off</strong>. Nothing changes until they approve it.
              </p>
            </div>
          )}

          <FieldShell id="b-alert" label="Alert threshold" error={errors.alert?.message}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={ALERT_MIN}
                max={ALERT_MAX}
                step={5}
                value={alertNum}
                onChange={(e) => setValue('alert', Number(e.target.value), { shouldDirty: true })}
                disabled={isSubmitting}
                aria-label="Alert threshold"
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
              <div className="relative w-[72px]">
                <input
                  id="b-alert"
                  type="number"
                  min={ALERT_MIN}
                  max={ALERT_MAX}
                  {...register('alert')}
                  aria-invalid={errors.alert ? true : undefined}
                  disabled={isSubmitting}
                  className={cn(inputClass, 'pr-6 text-right tabular-nums')}
                />
                <span className="text-body pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-caption">Accounting and the department head are notified when usage passes this level.</p>
          </FieldShell>

          <FieldShell
            id="b-reason"
            label={editing ? 'Reason for change' : 'Note'}
            required={editing}
            error={errors.reason?.message}
            hint={editing ? 'Kept in the budget’s history' : 'Optional, kept in the budget’s history'}
          >
            <textarea
              id="b-reason"
              rows={3}
              maxLength={500}
              placeholder={
                editing ? 'e.g. Laptop refresh for 6 new hires approved by the CFO (memo 2026-114).' : 'e.g. Approved annual plan'
              }
              {...register('reason')}
              aria-invalid={errors.reason ? true : undefined}
              disabled={isSubmitting}
              className={cn(inputClass, 'h-auto resize-none py-2')}
            />
          </FieldShell>

          {formError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="text-body-strong text-danger">Couldn’t save the budget</p>
                <p className="text-caption text-foreground">{formError.message}</p>
                {formError.requestId && <p className="text-caption">Reference: {formError.requestId}</p>}
              </div>
            </div>
          )}
          {!editing && (
            <p className="text-caption flex gap-1.5">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              “Used” starts at what the department already had approved in {yearLabel}.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : !editing ? 'Allocate budget' : needsSignoff ? 'Send for sign-off' : 'Save allocation'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

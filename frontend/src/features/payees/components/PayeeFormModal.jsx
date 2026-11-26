import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { createPayee, findSimilarPayees, updatePayee } from '../api'
import { payeeFormValues, payeeSchema, toPayeePayload } from '../schemas'
import { announcePayeesChanged, PAY_VIA } from '../utils'

/**
 * Add payee (Framer UKm7GrwEZ) and Edit payee (same form, filled in).
 * While the name or TIN is typed, the server is asked whether the payee is already on the list:
 * a same / similar name is a warning with "Use existing"; the same TIN can't be saved (shown in red).
 * Code differs from the frame: the warning isn't "AI" (it's a plain name / TIN comparison), and bank
 * details are asked only when the default payment is a bank transfer.
 */
export default function PayeeFormModal({ payee, types, companyName, prefillName = '', onClose, onSaved, onUseExisting }) {
  const editing = Boolean(payee)
  const [defaults] = useState(() => payeeFormValues(payee, prefillName))
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ resolver: zodResolver(payeeSchema), defaultValues: defaults })
  const [formError, setFormError] = useState(null)

  const [name, tin, method] = useWatch({ control, name: ['name', 'tin', 'default_payment_method'] })
  const matches = useSimilar(useDebounce(name, 400), useDebounce(tin, 400), payee?.id)
  const sameTin = matches.find((m) => m.reason === 'same_tin')
  const lookAlike = matches.find((m) => m.reason !== 'same_tin')

  const save = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const saved = editing
        ? await updatePayee(payee.id, toPayeePayload(values), payee.updated_at)
        : await createPayee(toPayeePayload(values))
      toast.success(
        editing ? `${saved.name} saved.` : `${saved.name} was added. Everyone in ${companyName ?? 'this company'} can use it now.`,
      )
      announcePayeesChanged()
      onSaved(saved)
    } catch (error) {
      if (error.code === 'PAYEE_CHANGED') {
        toast.error(error.message, { duration: 8000 })
        announcePayeesChanged()
        onClose()
        return
      }
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages], i) =>
          setError(field, { type: 'server', message: messages[0] }, { shouldFocus: i === 0 }),
        )
      } else {
        setFormError(error)
      }
    }
  })

  const field = (n) => ({
    id: `p-${n}`,
    'aria-invalid': errors[n] ? true : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  return (
    <ModalShell
      title={editing ? `Edit ${payee.name}` : 'Add payee'}
      subtitle={
        editing
          ? `Changes apply to new vouchers in ${companyName ?? 'this company'}.`
          : `New payees are available to everyone in ${companyName ?? 'this company'}.`
      }
      width={560}
      onClose={onClose}
      keepOpenOnBackdrop={isDirty}
    >
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <FieldShell id="p-name" label="Payee name" required error={errors.name?.message}>
            <input {...field('name')} {...register('name')} maxLength={255} placeholder="e.g. Juan’s Catering Services" autoFocus />
          </FieldShell>

          {lookAlike && (
            <div role="status" className="flex items-start gap-2.5 rounded-[10px] border border-warning bg-warning-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-caption flex-1 text-foreground">
                {lookAlike.reason === 'same_name' ? 'You already have ' : 'This looks like '}
                <span className="font-semibold">“{lookAlike.name}”</span>
                {lookAlike.tin && ` (TIN ${lookAlike.tin})`}
                {lookAlike.is_active ? '' : ', which is deactivated'}. Use it instead to avoid duplicates.
              </p>
              <button
                type="button"
                onClick={() => onUseExisting(lookAlike.id)}
                className="text-body-strong h-8 shrink-0 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Use existing
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldShell
              id="p-payee_type_id"
              label="Payee type"
              required
              error={errors.payee_type_id?.message}
              hint={types.length ? undefined : 'Your Admin hasn’t added payee types yet.'}
            >
              <Select {...field('payee_type_id')} {...register('payee_type_id')}>
                <option value="">Choose…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell
              id="p-tin"
              label="TIN"
              error={errors.tin?.message ?? (sameTin && `“${sameTin.name}” already has this TIN.`)}
              hint="9 or 12 digits"
            >
              <input {...field('tin')} {...register('tin')} inputMode="numeric" maxLength={20} placeholder="000-000-000-000" />
            </FieldShell>
            <FieldShell id="p-default_payment_method" label="Default payment method" error={errors.default_payment_method?.message}>
              <Select {...field('default_payment_method')} {...register('default_payment_method')}>
                <option value="">Not set</option>
                {Object.entries(PAY_VIA).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            {method === 'bank' && (
              <FieldShell id="p-bank_account_number" label="Bank account no." error={errors.bank_account_number?.message}>
                <input
                  {...field('bank_account_number')}
                  {...register('bank_account_number')}
                  inputMode="numeric"
                  maxLength={50}
                  placeholder="Optional"
                />
              </FieldShell>
            )}
            {method === 'bank' && (
              <FieldShell id="p-bank_name" label="Bank" error={errors.bank_name?.message}>
                <input {...field('bank_name')} {...register('bank_name')} maxLength={150} placeholder="e.g. BDO Ayala" />
              </FieldShell>
            )}
            {method === 'bank' && (
              <FieldShell id="p-bank_account_name" label="Account name" error={errors.bank_account_name?.message}>
                <input {...field('bank_account_name')} {...register('bank_account_name')} maxLength={150} />
              </FieldShell>
            )}
          </div>

          <FieldShell id="p-address" label="Business address" error={errors.address?.message}>
            <input {...field('address')} {...register('address')} maxLength={500} placeholder="Street, city, province" />
          </FieldShell>
          <FieldShell id="p-email" label="Contact email" error={errors.email?.message}>
            <input {...field('email')} {...register('email')} type="email" maxLength={255} placeholder="billing@company.ph" />
          </FieldShell>

          {formError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-body-strong text-danger">{formError.message}</p>
                {formError.requestId && <p className="text-caption mt-0.5">Reference: {formError.requestId}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t bg-muted px-6 py-3.5">
          <span className="text-caption mr-auto">
            <span className="text-danger">*</span> Required
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || Boolean(sameTin) || types.length === 0}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {editing ? 'Save changes' : 'Save payee'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/** Asks the server for look-alikes once typing pauses; a failed check just shows nothing (saving still checks). */
function useSimilar(name, tin, ignore) {
  const [result, setResult] = useState({ key: '', matches: [] })
  const key = `${name.trim()}|${tin.trim()}`
  const worth = name.trim().length >= 3 || tin.replace(/\D/g, '').length >= 9

  useEffect(() => {
    if (!worth) return undefined
    const controller = new AbortController()
    findSimilarPayees({ name: name.trim(), tin: tin.trim(), ignore, signal: controller.signal })
      .then((matches) => setResult({ key, matches }))
      .catch(() => {})
    return () => controller.abort()
  }, [key, worth, name, tin, ignore])

  return worth && result.key === key ? result.matches : []
}

function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select {...props} className={cn(className, 'appearance-none pr-9')}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}

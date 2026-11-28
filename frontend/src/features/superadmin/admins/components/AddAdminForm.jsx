import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader2, Mail, TriangleAlert } from 'lucide-react'
import EmailNameField from '@/components/common/EmailNameField'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { applyFieldErrors } from '@/lib/apiError'
import { ROLES } from '@/lib/constants'
import { createAdmin } from '../api'
import { createAdminSchema } from '../schemas'

/**
 * The "Create admin account" form (Framer TkIHF89oH, changed 2026-11-20 at the user's request):
 *   - ONE company per Admin (they become that company's System Administrator)
 *   - a PERSONAL email instead of a temporary password: the new Admin gets a one-time
 *     "set your password" link there, and chooses the password themselves
 * Errors: wrong fields -> red text under the field (zod now, server 422 after saving);
 * anything else (server down, no permission) -> red box above the footer, with a reference number.
 */
export default function AddAdminForm({ defaults, forCompany = null, onCancel, onCreated, onDirtyChange }) {
  const [formError, setFormError] = useState(null)
  // Pre-chosen company (?for=) if it's in the list (active, not suspended); else the only one, if there's just one
  const preset = defaults.companies.some((c) => c.id === forCompany) ? forCompany : null
  const startCompany = preset ?? (defaults.companies.length === 1 ? defaults.companies[0].id : '')
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { first_name: '', last_name: '', email_username: '', company_id: startCompany, personal_email: '' },
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const [emailUsername, companyId, personalEmail] = useWatch({
    control,
    name: ['email_username', 'company_id', 'personal_email'],
  })
  const company = defaults.companies.find((c) => c.id === Number(companyId))

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      onCreated(await createAdmin(values))
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const fieldProps = (name) => ({
    id: name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FieldShell id="first_name" label="First name" required error={errors.first_name?.message}>
            <input {...fieldProps('first_name')} {...register('first_name')} autoFocus placeholder="e.g. Carlo" />
          </FieldShell>
          <FieldShell id="last_name" label="Last name" required error={errors.last_name?.message}>
            <input {...fieldProps('last_name')} {...register('last_name')} placeholder="e.g. Reyes" />
          </FieldShell>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[200px_1fr]">
          <FieldShell id="employee_id" label="Employee ID" hint="Assigned when you save">
            <input
              id="employee_id"
              readOnly
              tabIndex={-1}
              value={defaults.employeeId ?? 'Assigned automatically'}
              className={`${inputClass} bg-muted text-muted-foreground`}
            />
          </FieldShell>
          <EmailNameField
            role={ROLES.ADMIN}
            registration={register('email_username')}
            value={emailUsername}
            error={errors.email_username?.message}
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FieldShell
            id="company_id"
            label="Company"
            required
            error={errors.company_id?.message}
            hint={
              company
                ? `${company.admins_count === 0 ? 'No Admin yet' : `Already has ${company.admins_count} Admin${company.admins_count === 1 ? '' : 's'}`}`
                : 'The one company this Admin will run'
            }
          >
            <div className="relative">
              <select {...fieldProps('company_id')} {...register('company_id')} className={`${inputClass} appearance-none pr-9`}>
                <option value="">Choose a company</option>
                {defaults.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.admins_count === 0 ? `${c.name} (no Admin yet)` : c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </FieldShell>
          <FieldShell
            id="personal_email"
            label="Personal email"
            required
            error={errors.personal_email?.message}
            hint="Their own inbox (e.g. Gmail). The set-password link goes here."
          >
            <input
              {...fieldProps('personal_email')}
              {...register('personal_email')}
              type="email"
              inputMode="email"
              spellCheck={false}
              placeholder="e.g. carlo.reyes@gmail.com"
            />
          </FieldShell>
        </div>

        <div className="flex items-start gap-3 rounded-[10px] border bg-muted px-3.5 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <p className="text-caption">
            After you create the account, we email{' '}
            <span className="font-medium text-foreground">{personalEmail?.trim() || 'their personal email'}</span> their sign-in email and a
            one-time link to choose their own password. The link expires in 72 hours. No password is ever sent.
          </p>
        </div>

        <div className="flex flex-col gap-0.5 rounded-[10px] bg-warning-soft px-3.5 py-3">
          <p className="text-badge text-warning">This gives full setup access to {company ? company.name : 'the company you choose'}</p>
          <p className="text-caption">The action is saved in the audit log, and the other Super Admins are notified.</p>
        </div>

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

      <div className="flex items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="text-auth-button flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating…' : 'Create admin'}
        </button>
      </div>
    </form>
  )
}

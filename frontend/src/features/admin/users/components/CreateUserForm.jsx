import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import { applyFieldErrors } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { createUser } from '../api'
import { createUserSchema } from '../schemas'
import EmailNameField from '@/components/common/EmailNameField'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { generatePassword } from '@/lib/password'
import CompanyAccessChips from './CompanyAccessChips'
import PasswordGenerator from './PasswordGenerator'
import RoleRadioCards from './RoleRadioCards'

// An Admin runs ONE company (2026-11-20), so that company is filled in already
const emptyForm = (companies = []) => {
  const active = companies.filter((c) => c.is_active)
  const only = active.length === 1 ? active[0].id : ''
  return {
    first_name: '',
    last_name: '',
    email_username: '',
    password: generatePassword(), // a fresh random password every time the form opens
    role: 'accounting_clerk',
    company_id: only,
    department_id: '',
    company_ids: only ? [only] : [],
  }
}

/**
 * The Create user form body + footer (Framer lmhV2DJV1).
 * react-hook-form keeps the values; zod checks them in the browser; the
 * server's 422 errors are put under the matching fields.
 */
export default function CreateUserForm({ companies, employeeIdPreview, onCancel, onCreated, onDirtyChange }) {
  const [formError, setFormError] = useState(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(createUserSchema), defaultValues: emptyForm(companies) })

  // Tell the modal whether anything was typed (so a stray click outside doesn't lose it).
  // Curly braces on purpose: an effect may only return nothing or a clean-up function.
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // useWatch = "re-draw when these fields change" (e.g. role -> the email domain shown)
  const [role, rawCompanyId, companyIds, password, emailUsername] = useWatch({
    control,
    name: ['role', 'company_id', 'company_ids', 'password', 'email_username'],
  })
  const companyId = Number(rawCompanyId) || null

  const activeCompanies = companies.filter((c) => c.is_active)
  const departments = useMemo(() => companies.find((c) => c.id === companyId)?.departments ?? [], [companies, companyId])

  // Choosing a primary company: reset the department, and make sure the company is in "Company access"
  const onPrimaryCompanyChange = (event) => {
    const id = Number(event.target.value) || ''
    setValue('company_id', id, { shouldDirty: true, shouldValidate: Boolean(errors.company_id) })
    setValue('department_id', '', { shouldDirty: true })
    if (id && !companyIds.includes(id)) setValue('company_ids', [...companyIds, id], { shouldDirty: true })
  }

  const toggleCompany = (id) => {
    const next = companyIds.includes(id) ? companyIds.filter((x) => x !== id) : [...companyIds, id]
    setValue('company_ids', next, { shouldDirty: true, shouldValidate: Boolean(errors.company_ids) })
  }

  const onSubmit = async (values) => {
    setFormError(null)
    const payload = {
      ...values,
      department_id: values.department_id || null,
      company_ids: values.company_ids,
    }
    try {
      onCreated(await createUser(payload), values)
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
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {/* Personal information */}
        <section className="flex flex-col gap-3">
          <h3 className="text-table-head text-muted-foreground">Personal information</h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <FieldShell id="first_name" label="First name" required error={errors.first_name?.message}>
              <input {...fieldProps('first_name')} {...register('first_name')} autoComplete="off" autoFocus placeholder="e.g. Maria" />
            </FieldShell>
            <FieldShell id="last_name" label="Last name" required error={errors.last_name?.message}>
              <input {...fieldProps('last_name')} {...register('last_name')} autoComplete="off" placeholder="e.g. Santos" />
            </FieldShell>
            <FieldShell id="employee_id" label="Employee ID" hint="Assigned automatically when you create the user.">
              <input
                id="employee_id"
                readOnly
                tabIndex={-1}
                value={
                  employeeIdPreview.status === 'loading'
                    ? 'Generating…'
                    : (employeeIdPreview.employeeId ?? 'Assigned automatically')
                }
                className={cn(inputClass, 'cursor-default bg-muted font-mono text-muted-foreground')}
              />
            </FieldShell>
            <EmailNameField
              role={role}
              registration={register('email_username')}
              value={emailUsername}
              error={errors.email_username?.message}
              disabled={isSubmitting}
            />
          </div>
        </section>

        {/* Role */}
        <RoleRadioCards
          value={role}
          onChange={(value) => setValue('role', value, { shouldDirty: true, shouldValidate: true })}
          error={errors.role?.message}
        />

        {/* Assignment & access */}
        <section className="flex flex-col gap-3">
          <h3 className="text-table-head text-muted-foreground">Assignment &amp; access</h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <FieldShell id="company_id" label="Primary company" required error={errors.company_id?.message}>
              <SelectWrap>
                <select {...fieldProps('company_id')} value={companyId ?? ''} onChange={onPrimaryCompanyChange}>
                  <option value="">Select a company</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </SelectWrap>
            </FieldShell>

            <FieldShell
              id="department_id"
              label="Department"
              error={errors.department_id?.message}
              hint="Optional. You can assign one later."
            >
              <SelectWrap>
                <select
                  {...fieldProps('department_id')}
                  {...register('department_id')}
                  disabled={isSubmitting || !companyId || departments.length === 0}
                >
                  <option value="">
                    {!companyId
                      ? 'Choose a company first'
                      : departments.length === 0
                        ? 'No departments yet'
                        : 'No department (optional)'}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </SelectWrap>
            </FieldShell>
          </div>

          <CompanyAccessChips
            companies={companies}
            selectedIds={companyIds}
            primaryId={companyId}
            onToggle={toggleCompany}
            error={errors.company_ids?.message}
          />
        </section>

        <PasswordGenerator
          value={password}
          onGenerate={() => setValue('password', generatePassword(), { shouldValidate: Boolean(errors.password) })}
          error={errors.password?.message}
          disabled={isSubmitting}
        />

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

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption">Fields marked * are required</p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="text-auth-button flex h-[38px] items-center gap-2 rounded-lg bg-primary px-[18px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </form>
  )
}

/** A native <select> with the design's ▾ arrow. */
function SelectWrap({ children }) {
  return (
    <div className={cn('relative [&>select]:appearance-none [&>select]:pr-9')}>
      {children}
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Loader2, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { applyFieldErrors } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { getUser, updateUser } from '../api'
import { useCompanyOptions } from '../hooks/useCompanyOptions'
import { announceUsersChanged, emailForRole } from '../utils'
import RoleRadioCards from './RoleRadioCards'

const schema = z.object({
  first_name: z.string().trim().min(1, 'Enter the first name.').max(100),
  last_name: z.string().trim().min(1, 'Enter the last name.').max(100),
  role: z.enum(['accounting_clerk', 'accounting_officer', 'supervisor_manager'], { error: 'Choose a role.' }),
  department_id: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
})

const FIELD_NAMES = { first_name: 'first name', last_name: 'last name', role: 'role', department_id: 'department', email: 'email' }

/**
 * "Edit user": name, role, department. Render inside <AnimatePresence>.
 * A ROLE CHANGE also changes the sign-in email (the domain follows the role) and signs the person
 * out; the form shows both before saving. If another Admin saved this person meanwhile, the server
 * answers 409 and the form reloads with their version (nothing is overwritten).
 */
export default function EditUserModal({ user: initial, onClose }) {
  const [user, setUser] = useState(initial)
  const [version, setVersion] = useState(0)
  const [conflict, setConflict] = useState(null)
  const [dirty, setDirty] = useState(false)

  const save = async (values) => {
    setConflict(null)
    try {
      const { changed, signedOut } = await updateUser(user.id, values, user.updated_at)
      announceUsersChanged()
      if (changed.length === 0) toast.success('Nothing to save: no changes.')
      else {
        toast.success(`${values.first_name} ${values.last_name} saved (${changed.map((f) => FIELD_NAMES[f] ?? f).join(', ')} changed).`)
        if (signedOut)
          toast(`They were signed out. Next time they sign in with ${emailForRole(user.email, values.role)}.`, { duration: 8000 })
      }
      onClose()
    } catch (error) {
      if (error.code !== 'USER_CHANGED') throw error
      try {
        setUser(await getUser(user.id))
        setVersion((v) => v + 1)
      } catch {
        // keep the old values; the message still explains
      }
      setConflict(error)
    }
  }

  return (
    <ModalShell
      title="Edit user"
      subtitle={`${initial.full_name} · ${initial.employee_id ?? 'no Employee ID'}`}
      width={680}
      onClose={onClose}
      keepOpenOnBackdrop={dirty}
    >
      <UserForm key={version} user={user} conflict={conflict} onSubmit={save} onCancel={onClose} onDirtyChange={setDirty} />
    </ModalShell>
  )
}

function UserForm({ user, conflict, onSubmit, onCancel, onDirtyChange }) {
  const options = useCompanyOptions()
  const [formError, setFormError] = useState(null)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { first_name: user.first_name, last_name: user.last_name, role: user.role, department_id: user.department?.id ?? '' },
  })

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const role = useWatch({ control, name: 'role' })
  const roleChanged = role !== user.role

  // Active departments, plus the one they're in now even if it was deactivated since
  const active = options.companies.find((c) => c.is_active)?.departments ?? []
  const departments =
    user.department && !active.some((d) => d.id === user.department.id)
      ? [...active, { ...user.department, name: `${user.department.name} (deactivated)` }]
      : active

  const submit = async (values) => {
    setFormError(null)
    try {
      await onSubmit({ ...values, department_id: values.department_id ? Number(values.department_id) : null })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const fieldProps = (name) => ({
    id: `edit-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `edit-${name}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  const shownError = formError ?? conflict

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FieldShell id="edit-first_name" label="First name" required error={errors.first_name?.message}>
            <input {...fieldProps('first_name')} {...register('first_name')} autoFocus />
          </FieldShell>
          <FieldShell id="edit-last_name" label="Last name" required error={errors.last_name?.message}>
            <input {...fieldProps('last_name')} {...register('last_name')} />
          </FieldShell>
        </div>

        <RoleRadioCards
          value={role}
          onChange={(value) => setValue('role', value, { shouldDirty: true, shouldValidate: true })}
          error={errors.role?.message}
        />

        {roleChanged && (
          <div className="flex flex-col gap-1 rounded-[10px] bg-warning-soft px-3.5 py-3">
            <p className="text-badge text-warning">Changing the role also changes their sign-in email</p>
            <p className="text-caption text-foreground">
              <span className="font-mono">{user.email}</span> →{' '}
              <span className="font-mono font-medium">{emailForRole(user.email, role)}</span>. They're signed out when you save, and their
              password stays the same. Tell them the new email.
            </p>
          </div>
        )}

        <FieldShell
          id="edit-department_id"
          label="Department"
          error={errors.department_id?.message}
          hint={options.status === 'error' ? "Couldn't load the departments. Close and open again to retry." : 'Optional.'}
        >
          <div className="relative">
            <select
              {...fieldProps('department_id')}
              {...register('department_id')}
              disabled={isSubmitting || options.status !== 'success'}
              className={cn(inputClass, 'appearance-none pr-9')}
            >
              <option value="">{options.status === 'loading' ? 'Loading departments…' : 'No department'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </FieldShell>

        {shownError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-body-strong text-danger">{shownError.message}</p>
              {shownError.requestId && <p className="text-caption mt-0.5">Reference: {shownError.requestId}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption">Saved in the audit log</p>
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
            {isSubmitting ? 'Saving…' : roleChanged ? 'Save and change role' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  )
}

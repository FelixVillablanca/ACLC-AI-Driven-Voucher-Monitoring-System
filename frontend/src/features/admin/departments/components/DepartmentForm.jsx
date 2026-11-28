import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { applyFieldErrors } from '@/lib/apiError'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useCompanyPeople } from '../hooks/useCompanyPeople'
import { createDepartmentSchema } from '../schemas'
import { suggestCode } from '../utils'

const EMPTY = { name: '', code: '', description: '', head_user_id: '' }

/**
 * The department fields + footer, shared by "Add department" and "Edit department".
 *   initial       the values to start with (Edit) or nothing (Add)
 *   currentHead   Edit only: the head as saved, so they stay choosable even if deactivated since
 *   onSubmit(values) must return a promise; a 422 is shown under the fields, anything else in a red box
 *   formError     an error the parent wants shown (e.g. 409 "someone else changed it")
 * The code follows the name (FIN for Finance) only while adding, until the Admin types their own.
 */
export default function DepartmentForm({
  initial,
  currentHead = null,
  note = null,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
  onDirtyChange,
  formError: parentError = null,
}) {
  const people = useCompanyPeople()
  const [formError, setFormError] = useState(null)
  const [codeTouched, setCodeTouched] = useState(Boolean(initial))
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: initial
      ? {
          name: initial.name ?? '',
          code: initial.code ?? '',
          description: initial.description ?? '',
          head_user_id: initial.head?.id ?? '',
        }
      : EMPTY,
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const name = useWatch({ control, name: 'name' })
  useEffect(() => {
    if (!codeTouched) setValue('code', suggestCode(name))
  }, [name, codeTouched, setValue])

  const submit = async (values) => {
    setFormError(null)
    try {
      await onSubmit({
        name: values.name,
        code: values.code.toUpperCase(),
        description: values.description?.trim() || null,
        head_user_id: values.head_user_id ? Number(values.head_user_id) : null,
      })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  // The saved head stays in the list even if they were deactivated since (the server allows keeping them)
  const choices =
    currentHead && !people.people.some((p) => p.id === currentHead.id)
      ? [{ id: currentHead.id, full_name: `${currentHead.full_name} (deactivated)`, role: null }, ...people.people]
      : people.people

  const fieldProps = (field) => ({
    id: `dept-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `dept-${field}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  const codeField = register('code')
  const shownError = formError ?? parentError

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {note}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_160px]">
          <FieldShell id="dept-name" label="Department name" required error={errors.name?.message}>
            <input {...fieldProps('name')} {...register('name')} autoFocus maxLength={150} placeholder="e.g. Finance" />
          </FieldShell>
          <FieldShell
            id="dept-code"
            label="Code"
            required
            error={errors.code?.message}
            hint={codeTouched ? 'Short and unique' : 'Suggested from the name'}
          >
            <input
              {...fieldProps('code')}
              {...codeField}
              onChange={(e) => {
                setCodeTouched(true)
                e.target.value = e.target.value.toUpperCase()
                codeField.onChange(e)
              }}
              maxLength={20}
              spellCheck={false}
              placeholder="FIN"
              className={cn(inputClass, 'font-mono uppercase')}
            />
          </FieldShell>
        </div>

        <FieldShell id="dept-head_user_id" label="Department head" error={errors.head_user_id?.message} hint={headHint(people)}>
          <div className="relative">
            <select
              {...fieldProps('head_user_id')}
              {...register('head_user_id')}
              disabled={isSubmitting || people.status !== 'success' || choices.length === 0}
              className={cn(inputClass, 'appearance-none pr-9')}
            >
              <option value="">
                {people.status === 'loading'
                  ? 'Loading people…'
                  : people.status === 'error'
                    ? "Couldn't load people"
                    : choices.length === 0
                      ? 'No people in your company yet'
                      : 'No head (optional)'}
              </option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.role ? `${p.full_name} · ${ROLE_SHORT_LABELS[p.role] ?? p.role}` : p.full_name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          {people.status === 'error' && (
            <button
              type="button"
              onClick={people.retry}
              className="text-caption flex w-fit items-center gap-1 font-medium text-primary hover:underline"
            >
              <RotateCw className="size-3" aria-hidden="true" /> Try loading people again
            </button>
          )}
        </FieldShell>

        <FieldShell
          id="dept-description"
          label="Description"
          error={errors.description?.message}
          hint="Optional. What this department does."
        >
          <textarea
            {...fieldProps('description')}
            {...register('description')}
            rows={3}
            maxLength={500}
            placeholder="e.g. Pays suppliers and keeps the books."
            className={cn(inputClass, 'h-auto resize-none py-2')}
          />
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
            {isSubmitting ? busyLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

function headHint(people) {
  if (people.status === 'error') return people.error?.message ?? 'Optional. You can choose a head later.'
  if (people.status === 'success' && people.people.length === 0) return 'Create users first, then choose a head.'
  return 'Optional. The head joins this department (moved from their current one, if any). One head per department.'
}

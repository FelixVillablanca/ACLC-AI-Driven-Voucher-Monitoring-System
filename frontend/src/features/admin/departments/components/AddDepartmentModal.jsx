import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence } from 'framer-motion'
import { Building2, CheckCircle2, ChevronDown, Layers, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { applyFieldErrors } from '@/lib/apiError'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { createDepartment } from '../api'
import { useCompanyPeople } from '../hooks/useCompanyPeople'
import { createDepartmentSchema } from '../schemas'
import { DEPARTMENTS_CHANGED_EVENT, suggestCode } from '../utils'

const EMPTY = { name: '', code: '', description: '', head_user_id: '' }

/**
 * "Add department" (Quick actions, code-first 2026-11-22). Opens on any admin page with ?create=department.
 * The department always goes into the Admin's own company (shown, not chosen).
 */
export default function AddDepartmentModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('create') === 'department'

  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete('create')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  return <AnimatePresence>{open && <Window onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [created, setCreated] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [dirty, setDirty] = useState(false)

  const onCreated = (department) => {
    setCreated(department)
    setDirty(false)
    toast.success(`${department.name} was added to ${companyName}.`)
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))
  }

  return (
    <ModalShell
      title={created ? 'Department added' : 'Add department'}
      subtitle={
        created ? `It's ready in ${companyName}. You can add people to it when you create users.` : `A new department in ${companyName}.`
      }
      width={600}
      onClose={onClose}
      keepOpenOnBackdrop={dirty && !created}
    >
      {created ? (
        <CreatedView
          department={created}
          onAnother={() => {
            setCreated(null)
            setFormKey((k) => k + 1)
          }}
          onDone={onClose}
        />
      ) : (
        <DepartmentForm key={formKey} companyName={companyName} onCancel={onClose} onCreated={onCreated} onDirtyChange={setDirty} />
      )}
    </ModalShell>
  )
}

function DepartmentForm({ companyName, onCancel, onCreated, onDirtyChange }) {
  const people = useCompanyPeople()
  const [formError, setFormError] = useState(null)
  const [codeTouched, setCodeTouched] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(createDepartmentSchema), defaultValues: EMPTY })

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange])

  // The code follows the name (FIN for Finance) until the Admin types their own
  const name = useWatch({ control, name: 'name' })
  useEffect(() => {
    if (!codeTouched) setValue('code', suggestCode(name))
  }, [name, codeTouched, setValue])

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      onCreated(
        await createDepartment({
          name: values.name,
          code: values.code.toUpperCase(),
          description: values.description?.trim() || null,
          head_user_id: values.head_user_id || null,
        }),
      )
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const fieldProps = (field) => ({
    id: `dept-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `dept-${field}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  const codeField = register('code')

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-2.5 rounded-[10px] border bg-muted px-3.5 py-2.5">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-caption">
            Company: <span className="font-medium text-foreground">{companyName}</span> (departments are always added to your company)
          </p>
        </div>

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
              disabled={isSubmitting || people.status !== 'success' || people.people.length === 0}
              className={cn(inputClass, 'appearance-none pr-9')}
            >
              <option value="">
                {people.status === 'loading'
                  ? 'Loading people…'
                  : people.status === 'error'
                    ? "Couldn't load people"
                    : people.people.length === 0
                      ? 'No people in your company yet'
                      : 'No head yet (optional)'}
              </option>
              {people.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · {ROLE_SHORT_LABELS[p.role] ?? p.role}
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
            {isSubmitting ? 'Adding…' : 'Add department'}
          </button>
        </div>
      </div>
    </form>
  )
}

function headHint(people) {
  if (people.status === 'error') return people.error?.message ?? 'Optional. You can choose a head later.'
  if (people.status === 'success' && people.people.length === 0) return 'Create users first, then choose a head.'
  return 'Optional. You can choose one later.'
}

function CreatedView({ department, onAnother, onDone }) {
  return (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border bg-success-soft/50 px-4 py-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Layers className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-card-title truncate">
              {department.name} <span className="text-caption font-mono">{department.code}</span>
            </p>
            <p className="text-caption truncate">{department.head ? `Head: ${department.head.full_name}` : 'No head yet'}</p>
          </div>
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        </div>
        {department.description && <p className="text-caption">{department.description}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onAnother}
          className="text-body-strong mr-auto h-[38px] rounded-lg px-2 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Add another department
        </button>
        <button
          type="button"
          onClick={onDone}
          autoFocus
          className="text-auth-button h-[38px] rounded-lg bg-primary px-[18px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Done
        </button>
      </div>
    </>
  )
}

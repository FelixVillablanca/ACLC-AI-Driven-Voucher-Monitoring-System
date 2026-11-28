import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, TriangleAlert, UserCheck, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { applyFieldErrors } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { createCompany } from '../api'
import { COMPANY_TYPES, createCompanySchema } from '../schemas'
import AdminInChargeField from './AdminInChargeField'
import LocationPicker from './LocationPicker'
import { announceCompaniesChanged, companyInitials, companySubtitle, TYPE_LABELS } from '../utils'

const EMPTY = {
  name: '',
  type: 'corporate',
  address: '',
  latitude: null,
  longitude: null,
  place_id: null,
  contact_email: '',
  contact_phone: '',
  tin_number: '',
  fiscal_year_start: '',
  admin_id: '', // optional: an Admin with no company yet
}

/**
 * "+ Add company" (code-first 2026-11-22, no frame). Opens on the Companies tab with ?create=company.
 * Only Super Admins create companies; each company then needs an Admin, so the success view
 * offers "Add its admin", which opens Add admin with this company already chosen.
 */
export default function AddCompanyModal({ open, onClose, onAddAdmin }) {
  return <AnimatePresence>{open && <ModalWindow onClose={onClose} onAddAdmin={onAddAdmin} />}</AnimatePresence>
}

function ModalWindow({ onClose, onAddAdmin }) {
  const [created, setCreated] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const dirtyRef = useRef(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rememberDirty = useCallback((dirty) => {
    dirtyRef.current = dirty
  }, [])

  // A click on the backdrop closes it, unless something was typed
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && (created || !dirtyRef.current)) onClose()
  }

  const onCreated = (company) => {
    setCreated(company)
    dirtyRef.current = false
    toast.success(`${company.name} was added.`)
    announceCompaniesChanged()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-16"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-company-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex max-h-[calc(100dvh-2rem)] w-[640px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="add-company-title" className="text-page-title">
              {created ? 'Company added' : 'Add company'}
            </h2>
            <p className="text-body text-muted-foreground">
              {created
                ? 'Next, give it an Admin. The Admin sets up its departments and users.'
                : 'A new organisation on the platform. You choose its Admin in the next step.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {created ? (
          <CreatedView
            company={created}
            onAddAdmin={() => onAddAdmin(created)}
            onAnother={() => {
              setCreated(null)
              setFormKey((k) => k + 1)
            }}
            onDone={onClose}
          />
        ) : (
          <AddCompanyForm key={formKey} onCancel={onClose} onCreated={onCreated} onDirtyChange={rememberDirty} />
        )}
      </motion.div>
    </motion.div>
  )
}

function AddCompanyForm({ onCancel, onCreated, onDirtyChange }) {
  const [formError, setFormError] = useState(null)
  const [adminsReload, setAdminsReload] = useState(0)
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(createCompanySchema), defaultValues: EMPTY })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const type = useWatch({ control, name: 'type' })
  const adminId = useWatch({ control, name: 'admin_id' })
  const setAdminId = useCallback((id) => setValue('admin_id', id, { shouldDirty: true }), [setValue])
  const [address, latitude, longitude, placeId] = useWatch({ control, name: ['address', 'latitude', 'longitude', 'place_id'] })
  const pin = latitude != null && longitude != null ? { lat: latitude, lng: longitude, placeId } : null

  const setPin = useCallback(
    (next) => {
      const options = { shouldDirty: true }
      setValue('latitude', next?.lat ?? null, options)
      setValue('longitude', next?.lng ?? null, options)
      setValue('place_id', next?.placeId ?? null, options)
    },
    [setValue],
  )
  const setAddressFromMap = useCallback(
    (text) => setValue('address', text.slice(0, 500), { shouldDirty: true, shouldValidate: true }),
    [setValue],
  )
  const pinError = errors.latitude?.message ?? errors.longitude?.message ?? errors.place_id?.message

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      // empty optional fields are sent as null, not ""
      const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v]))
      onCreated(await createCompany(body))
    } catch (error) {
      // the picked Admin was given a company a moment ago: show why and load the list again
      if (error.code === 'ADMIN_ALREADY_ASSIGNED' || error.errors?.admin_id) setAdminsReload((n) => n + 1)
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const fieldProps = (name) => ({
    id: `company-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `company-${name}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <FieldShell
          id="company-name"
          label="Company name"
          required
          error={errors.name?.message}
          hint="As it should appear everywhere, e.g. on vouchers."
        >
          <input {...fieldProps('name')} {...register('name')} autoFocus maxLength={150} placeholder="e.g. Bayview Logistics Corp." />
        </FieldShell>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-label mb-1.5 flex items-center gap-0.5">
            Type
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          </legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {COMPANY_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                disabled={isSubmitting}
                onClick={() => setValue('type', value, { shouldDirty: true, shouldValidate: true })}
                className={cn(
                  'text-body-strong h-9 rounded-full border px-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  type === value ? 'border-primary bg-primary-faint text-primary' : 'bg-card hover:bg-muted',
                )}
              >
                {TYPE_LABELS[value]}
              </button>
            ))}
          </div>
          {errors.type && <p className="text-caption text-danger">{errors.type.message}</p>}
        </fieldset>

        <FieldShell
          id="company-address"
          label="Address"
          error={errors.address?.message}
          hint="Shown on the company card. Type the full address and the map pin moves there."
        >
          <input
            {...fieldProps('address')}
            {...register('address')}
            maxLength={500}
            placeholder="e.g. 123 Ortigas Ave, Ortigas Center, Pasig City"
          />
        </FieldShell>

        <div className="-mt-1 flex flex-col gap-1.5">
          <LocationPicker address={address} pin={pin} disabled={isSubmitting} onPinChange={setPin} onAddressFromMap={setAddressFromMap} />
          {pinError && <p className="text-caption text-danger">{pinError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FieldShell id="company-contact_email" label="Contact email" error={errors.contact_email?.message}>
            <input
              {...fieldProps('contact_email')}
              {...register('contact_email')}
              type="email"
              inputMode="email"
              spellCheck={false}
              placeholder="e.g. finance@bayview.ph"
            />
          </FieldShell>
          <FieldShell id="company-contact_phone" label="Contact phone" error={errors.contact_phone?.message}>
            <input
              {...fieldProps('contact_phone')}
              {...register('contact_phone')}
              type="tel"
              maxLength={20}
              placeholder="e.g. +63 2 8123 4567"
            />
          </FieldShell>
          <FieldShell id="company-tin_number" label="TIN" error={errors.tin_number?.message}>
            <input {...fieldProps('tin_number')} {...register('tin_number')} maxLength={50} placeholder="e.g. 123-456-789-000" />
          </FieldShell>
          <FieldShell
            id="company-fiscal_year_start"
            label="Fiscal year starts"
            error={errors.fiscal_year_start?.message}
            hint="Optional. Used for budgets later."
          >
            <input {...fieldProps('fiscal_year_start')} {...register('fiscal_year_start')} type="date" />
          </FieldShell>
        </div>

        <AdminInChargeField
          value={adminId ?? ''}
          onChange={setAdminId}
          error={errors.admin_id?.message}
          disabled={isSubmitting}
          reloadKey={adminsReload}
        />

        <div className="flex flex-col gap-0.5 rounded-[10px] bg-muted px-3.5 py-3">
          <p className="text-badge">The company is active right away</p>
          <p className="text-caption">
            {adminId ? 'Its Admin gets a notice and can start setting it up.' : 'Nobody can use it until you give it an Admin.'} Adding it
            is saved in the audit log, and the other Super Admins are notified.
          </p>
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
          {isSubmitting ? 'Adding…' : 'Add company'}
        </button>
      </div>
    </form>
  )
}

function CreatedView({ company, onAddAdmin, onAnother, onDone }) {
  return (
    <>
      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border bg-success-soft/50 px-4 py-3.5">
          <span className="text-badge flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            {companyInitials(company.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-card-title truncate">{company.name}</p>
            <p className="text-caption truncate">{companySubtitle(company)}</p>
          </div>
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        </div>

        {company.admin ? (
          <div className="flex items-start gap-3 rounded-[10px] bg-success-soft px-3.5 py-3">
            <UserCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-caption text-foreground">
              <span className="font-medium">{company.admin.full_name} runs it now.</span> They got a notice and can set up its departments
              and users from their Admin console.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-[10px] bg-warning-soft px-3.5 py-3">
            <UserPlus className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-caption text-foreground">
              <span className="font-medium">No Admin yet.</span> {company.name} is now in the Company list of Add admin. Add its Admin now,
              or later from the Admins tab.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onAnother}
          className="text-body-strong mr-auto h-10 rounded-lg px-2 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Add another company
        </button>
        {company.admin ? (
          <button
            type="button"
            onClick={onDone}
            autoFocus
            className="text-auth-button flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onDone}
              className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Done
            </button>
            <button
              type="button"
              onClick={onAddAdmin}
              autoFocus
              className="text-auth-button flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <UserPlus className="size-4" aria-hidden="true" /> Add its admin
            </button>
          </>
        )}
      </div>
    </>
  )
}

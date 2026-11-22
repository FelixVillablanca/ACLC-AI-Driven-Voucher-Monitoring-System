import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { applyFieldErrors } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { createCatalogItem, updateCatalogItem } from '../api'
import { announceCatalogChanged, suggestCode } from '../utils'

const schemaFor = (details) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(details ? 100 : 150, 'That name is too long.'),
    ...(details
      ? {
          code: z
            .string()
            .trim()
            .max(20, 'The code can be at most 20 characters.')
            .regex(/^([A-Za-z0-9]+(-[A-Za-z0-9]+)*)?$/, 'Use letters and numbers, with - between parts (e.g. OFF or IT-EQ).'),
          description: z.string().trim().max(500, 'Use at most 500 characters.'),
        }
      : {}),
  })

/**
 * Add / edit one item of a Categories-page list. `kind` = one entry of KINDS; `item` = null to add.
 * Render inside <AnimatePresence>. A 409 (someone else saved it) closes the window with a message,
 * since the list refreshes to their version.
 */
export default function CatalogItemModal({ kind, item, onClose }) {
  const editing = Boolean(item)
  const [formError, setFormError] = useState(null)
  const [codeTouched, setCodeTouched] = useState(editing)
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schemaFor(kind.details)),
    defaultValues: { name: item?.name ?? '', ...(kind.details ? { code: item?.code ?? '', description: item?.description ?? '' } : {}) },
  })

  const name = useWatch({ control, name: 'name' })
  useEffect(() => {
    if (kind.details && !codeTouched) setValue('code', suggestCode(name))
  }, [kind.details, name, codeTouched, setValue])

  const submit = async (values) => {
    setFormError(null)
    const body = kind.details
      ? { name: values.name, code: values.code ? values.code.toUpperCase() : null, description: values.description || null }
      : { name: values.name }
    try {
      if (editing) {
        const { changed } = await updateCatalogItem(kind.key, item.id, body, item.updated_at)
        toast.success(changed.length ? `“${values.name}” saved.` : 'Nothing to save: no changes.')
      } else {
        await createCatalogItem(kind.key, body)
        toast.success(`“${values.name}” was added.`)
      }
      announceCatalogChanged()
      onClose()
    } catch (error) {
      if (error.code === 'CATALOG_CHANGED') {
        announceCatalogChanged()
        toast.error(error.message, { duration: 8000 })
        onClose()
        return
      }
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const fieldProps = (field) => ({
    id: `cat-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `cat-${field}-error` : undefined,
    className: inputClass,
    disabled: isSubmitting,
    autoComplete: 'off',
  })
  const codeField = kind.details ? register('code') : null

  return (
    <ModalShell
      title={editing ? `Edit ${kind.one}` : `Add ${kind.one}`}
      subtitle={editing ? item.name : kind.intro}
      width={kind.details ? 600 : 480}
      onClose={onClose}
      keepOpenOnBackdrop={isDirty}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className={cn('grid grid-cols-1 gap-3.5', kind.details && 'sm:grid-cols-[1fr_150px]')}>
            <FieldShell id="cat-name" label="Name" required error={errors.name?.message}>
              <input {...fieldProps('name')} {...register('name')} autoFocus placeholder={kind.example} />
            </FieldShell>
            {kind.details && (
              <FieldShell
                id="cat-code"
                label="Code"
                error={errors.code?.message}
                hint={codeTouched ? 'Optional, short' : 'Suggested from the name'}
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
                  placeholder="OFF"
                  className={cn(inputClass, 'font-mono uppercase')}
                />
              </FieldShell>
            )}
          </div>

          {kind.details && (
            <FieldShell
              id="cat-description"
              label="Description"
              error={errors.description?.message}
              hint="Optional. Helps clerks (and the AI suggestion) pick the right one."
            >
              <textarea
                {...fieldProps('description')}
                {...register('description')}
                rows={3}
                maxLength={500}
                placeholder="e.g. Pens, paper, printer ink and other small office items."
                className={cn(inputClass, 'h-auto resize-none py-2')}
              />
            </FieldShell>
          )}

          {editing && item.vouchers_count > 0 && (
            <p className="text-caption rounded-[10px] bg-muted px-3.5 py-2.5">
              Used by {item.vouchers_count} {item.vouchers_count === 1 ? 'voucher' : 'vouchers'}. They will show the new name.
            </p>
          )}

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
            onClick={onClose}
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
            {isSubmitting ? 'Saving…' : editing ? 'Save changes' : `Add ${kind.one}`}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Banknote, Check, ChevronDown, Info, Loader2, Plus, Send, Trash2, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { createVoucher, getVoucher, getVoucherFormOptions, submitVoucher, updateVoucher } from '../api'
import ReturnedBanner from '../components/ReturnedBanner'
import ReturnSummary from '../components/ReturnSummary'
import { EMPTY_LINE, formValues, toPayload, voucherSchema } from '../schemas'
import { announceVouchersChanged, centsToAmount, lineCents, PAYMENT_LABELS, PRIORITY_LABELS } from '../utils'

const AUTOSAVE_MS = 30_000

/**
 * Create voucher (/clerk/vouchers/new) and Edit (/clerk/vouchers/:id/edit, drafts and returned vouchers).
 * Save draft keeps it private and may be incomplete. Save & submit saves, then sends it to the Accounting
 * Officer; if something's missing, the server says what (under the fields) and it stays a draft.
 * The total shown here is worked out in centavos; the server adds it up again and its total is the one kept.
 * A RETURNED voucher opens as "Fix & resubmit" (Framer EWrCKOIlI, 2026-11-26): wider, the reviewer's note on
 * top, Save changes / Resubmit for review in the header, and a summary column (total then vs. now, route).
 */
export default function VoucherFormPage() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const prefillPayeeId = id ? null : Number(search.get('payee')) || null // "New voucher for Meralco" (Payees panel)
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const [load, setLoad] = useState({ key: null, status: 'loading', options: null, voucher: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${id ?? 'new'}|${companyId}|${attempt}`

  useEffect(() => {
    let alive = true
    Promise.all([getVoucherFormOptions(), id ? getVoucher(id) : Promise.resolve(null)])
      .then(([options, voucher]) => alive && setLoad({ key, status: 'success', options, voucher, error: null }))
      .catch((error) => alive && setLoad({ key, status: 'error', options: null, voucher: null, error }))
    return () => {
      alive = false
    }
  }, [id, key])

  const status = load.key === key ? load.status : 'loading'
  const returned = status === 'success' && load.voucher?.status === 'returned'

  return (
    <div className={cn('mx-auto flex w-full flex-col gap-4 px-4 py-6 sm:px-7', returned ? 'max-w-[1200px]' : 'max-w-[1000px]')}>
      <Link
        to={returned ? PATHS.CLERK_RETURNED : id ? `${PATHS.CLERK_VOUCHERS}/${id}` : PATHS.CLERK_VOUCHERS}
        className="text-caption flex w-fit items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> {returned ? 'Returned to me' : id ? 'Back to the voucher' : 'My vouchers'}
      </Link>

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-16">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the form…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={load.error.status === 404 ? 'Voucher not found' : "Couldn't load the form"}
            message={load.error.status === 404 ? "It isn't one of your vouchers in this company." : load.error.message}
            requestId={load.error.requestId}
            onRetry={load.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && load.voucher && !load.voucher.can.edit && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="This voucher can't be changed"
            message="Only drafts and returned vouchers can be edited. This one is with a reviewer or finished."
          />
          <div className="flex justify-center pb-8">
            <Link to={`${PATHS.CLERK_VOUCHERS}/${id}`} className="text-auth-link text-primary hover:underline">
              Open the voucher →
            </Link>
          </div>
        </div>
      )}

      {status === 'success' && (!load.voucher || load.voucher.can.edit) && (
        <VoucherForm
          key={`${load.voucher?.id ?? 'new'}|${attempt}`}
          options={load.options}
          prefillPayeeId={prefillPayeeId}
          voucher={load.voucher}
          onReload={() => setAttempt((n) => n + 1)}
        />
      )}
    </div>
  )
}

function VoucherForm({ options, voucher, prefillPayeeId, onReload }) {
  const navigate = useNavigate()
  const isReturned = voucher?.status === 'returned'
  const [savedNow, setSavedNow] = useState(false) // a save on this visit (Returned banner chip)
  const [busy, setBusy] = useState(null) // 'save' | 'submit'
  const [formError, setFormError] = useState(null)
  const [defaults] = useState(() => {
    const values = formValues(voucher, options.my_department_id)
    const payee = prefillPayeeId && options.payees?.find((p) => p.id === prefillPayeeId)
    return payee ? { ...values, ...payeeFill(payee, values) } : values
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(voucherSchema), defaultValues: defaults })
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const [method, lines, categoryId, payeeName] = useWatch({ control, name: ['payment_method', 'line_items', 'category_id', 'payee_name'] })

  // Saved payees (2026-11-26): a name that matches one fills its type, payment method and bank details
  // (empty fields only, except the payment method); the server links the voucher to it when saving.
  const savedPayee = findPayee(options.payees, payeeName)
  const lastPayeeRef = useRef(savedPayee?.id ?? null)
  useEffect(() => {
    if (!savedPayee || savedPayee.id === lastPayeeRef.current) return
    lastPayeeRef.current = savedPayee.id
    Object.entries(payeeFill(savedPayee, getValues())).forEach(([k, v]) => setValue(k, v, { shouldDirty: true }))
  }, [savedPayee, getValues, setValue])
  const totalCents = (lines ?? []).reduce((sum, l) => sum + lineCents(l.quantity, l.unit_price), 0)
  const category = options.categories.find((c) => c.id === Number(categoryId))

  // what the form looked like at the last successful save: "unsaved changes" = the form differs from it
  const lastSavedRef = useRef(JSON.stringify(defaults))
  const snapshot = () => JSON.stringify(getValues())

  // warn before leaving with unsaved typing
  useEffect(() => {
    const onLeave = (e) => {
      if (JSON.stringify(getValues()) === lastSavedRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [getValues])

  const showServerErrors = (error) => {
    if (!error?.errors) return false
    Object.entries(error.errors).forEach(([field, messages], i) =>
      setError(field, { type: 'server', message: messages[0] }, { shouldFocus: i === 0 }),
    )
    return true
  }

  // the saved voucher's id and "last changed" time: after the first save, later saves UPDATE it (never a
  // second draft), and the conflict check uses the newest time (not the one the form opened with)
  const idRef = useRef(voucher?.id ?? null)
  const stampRef = useRef(voucher?.updated_at ?? null)

  // Saves run ONE AT A TIME (a queue): an auto-save and a click on Save draft can't race each other, and
  // each one sends the "last changed" time the previous one got back, so they never trip the conflict check.
  const queueRef = useRef(Promise.resolve())
  const save = (values) => {
    const next = queueRef.current.then(async () => {
      const payload = toPayload(values)
      const saved = idRef.current ? await updateVoucher(idRef.current, payload, stampRef.current) : await createVoucher(payload)
      idRef.current = saved.id
      stampRef.current = saved.updated_at
      return saved
    })
    queueRef.current = next.catch(() => {})
    return next
  }

  // AUTO-SAVE (drafts only; Drafts page promise): every 30 s, if something changed, save it as a draft.
  // Half-typed lines (no description and no price) are left out of that save; the form keeps them.
  const autoOn = !voucher || voucher.status === 'draft'
  const [auto, setAuto] = useState({ state: 'idle', at: null })
  const busyRef = useRef(null)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    if (!autoOn) return undefined
    let running = false
    let stopped = false
    const tick = async () => {
      if (running || stopped || busyRef.current) return
      const snap = JSON.stringify(getValues())
      if (snap === lastSavedRef.current) return
      const raw = getValues()
      const parsed = voucherSchema.safeParse({
        ...raw,
        line_items: raw.line_items.filter((l) => l.description.trim() || l.unit_price.trim()),
      })
      if (!parsed.success) {
        setAuto((a) => ({ ...a, state: 'waiting' }))
        return
      }
      running = true
      setAuto((a) => ({ ...a, state: 'saving' }))
      try {
        await save(parsed.data)
        lastSavedRef.current = snap
        setAuto({ state: 'saved', at: new Date() })
        announceVouchersChanged()
      } catch (error) {
        if (error.code === 'VOUCHER_CHANGED' || error.code === 'VOUCHER_LOCKED' || error.status === 404) {
          stopped = true // never overwrite another window's work: stop and let the person reload
          setAuto({ state: 'conflict', at: null })
        } else {
          setAuto((a) => ({ ...a, state: 'failed' }))
        }
      } finally {
        running = false
      }
    }
    const timer = window.setInterval(tick, AUTOSAVE_MS)
    return () => window.clearInterval(timer)
    // save / getValues are stable for this form's life (refs inside); the timer starts once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOn])

  const run = (action) =>
    handleSubmit(async (values) => {
      setBusy(action)
      setFormError(null)
      let saved
      const snap = snapshot()
      try {
        saved = await save(values)
        lastSavedRef.current = snap
        setAuto({ state: 'saved', at: new Date() })
        setSavedNow(true)
        announceVouchersChanged()
      } catch (error) {
        setBusy(null)
        if (error.code === 'VOUCHER_CHANGED') {
          toast.error(error.message, { duration: 8000 })
          onReload()
          return
        }
        if (!showServerErrors(error)) setFormError(error)
        return
      }

      if (action === 'save') {
        toast.success(
          isReturned
            ? 'Changes saved. It stays with you until you resubmit it.'
            : voucher
              ? 'Draft saved.'
              : 'Draft saved. Only you can see it until you submit it.',
        )
        setBusy(null)
        if (!voucher) navigate(`${PATHS.CLERK_VOUCHERS}/${saved.id}/edit`, { replace: true }) // its own address now
        return
      }

      try {
        const sent = await submitVoucher(saved.id)
        announceVouchersChanged()
        toast.success(`${sent.voucher_number} was ${isReturned ? 'resubmitted' : 'sent'} to the Accounting Officers.`)
        navigate(`${PATHS.CLERK_VOUCHERS}/${saved.id}`)
      } catch (error) {
        setBusy(null)
        // it's saved, but not complete enough to submit: say what's missing and stay here (the form keeps
        // the saved id, so fixing and submitting again updates the same draft)
        toast.error(
          isReturned
            ? 'Your changes are saved. Fix the marked fields to resubmit it.'
            : 'Saved as a draft. Fix the marked fields to submit it.',
          { duration: 6000 },
        )
        if (!showServerErrors(error)) setFormError(error)
      }
    })()

  const fieldProps = (name) => ({
    id: `v-${name}`,
    'aria-invalid': get(errors, name) ? true : undefined,
    className: inputClass,
    disabled: Boolean(busy),
    autoComplete: 'off',
  })

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-4">
      {isReturned ? (
        <div className="flex flex-wrap items-end justify-between gap-2.5">
          <div className="flex flex-col gap-1">
            <h1 className="text-page-title">Fix &amp; resubmit · {voucher.voucher_number}</h1>
            <p className="text-body text-muted-foreground">
              {voucher.payee_name ? `${voucher.payee_name} · ` : ''}make the changes and resubmit; it keeps its number
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <SaveButton busy={busy} onClick={() => run('save')} label="Save changes" />
            <SubmitButton busy={busy} onClick={() => run('submit')} label="Resubmit for review" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">{voucher ? 'Edit draft' : 'Create voucher'}</h1>
          <p className="text-body text-muted-foreground">Save it as a draft any time. Submit it when it’s complete.</p>
        </div>
      )}

      {isReturned && <ReturnedBanner returned={voucher.returned} saved={savedNow || voucher.returned?.edited_since} />}

      <div className={cn('flex flex-col gap-4', isReturned && 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-[18px]')}>
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Payee">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FieldShell id="v-payee_name" label="Who gets paid" error={errors.payee_name?.message}>
                <input
                  {...fieldProps('payee_name')}
                  {...register('payee_name')}
                  list="v-payee-list"
                  maxLength={255}
                  placeholder={options.payees?.length ? 'Start typing a saved payee…' : 'e.g. Metro Office Supplies'}
                />
                <datalist id="v-payee-list">
                  {(options.payees ?? []).map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
                {!errors.payee_name && payeeName?.trim() && (
                  <p className={cn('text-caption', savedPayee && 'text-success')}>
                    {savedPayee
                      ? `✓ Saved payee${savedPayee.tin ? ` · TIN ${savedPayee.tin}` : ''}`
                      : 'Not a saved payee: kept as typed. Add it under Reference → Payees to reuse it.'}
                  </p>
                )}
              </FieldShell>
              <FieldShell
                id="v-payee_type_id"
                label="Payee type"
                error={errors.payee_type_id?.message}
                hint={options.payee_types.length ? undefined : 'Your Admin hasn’t added payee types yet.'}
              >
                <Select {...fieldProps('payee_type_id')} {...register('payee_type_id')}>
                  <option value="">Choose…</option>
                  {options.payee_types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <div className="sm:col-span-2">
                <FieldShell
                  id="v-payee_email"
                  label="Payee’s email"
                  error={errors.payee_email?.message}
                  hint="Optional. After the final approval you can email them the approval and the payment PDF."
                >
                  <input
                    {...fieldProps('payee_email')}
                    {...register('payee_email')}
                    type="email"
                    inputMode="email"
                    spellCheck={false}
                    maxLength={255}
                    placeholder="e.g. accounts@supplier.ph"
                  />
                </FieldShell>
              </div>
            </div>
          </Card>

          <Card title="Details">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FieldShell
                id="v-category_id"
                label="Category"
                required
                error={errors.category_id?.message}
                hint={category?.description ?? (options.categories.length ? undefined : 'No categories yet: ask your Admin.')}
              >
                <Select {...fieldProps('category_id')} {...register('category_id')}>
                  <option value="">Choose…</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.code ? ` (${c.code})` : ''}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell id="v-voucher_type_id" label="Voucher type" error={errors.voucher_type_id?.message}>
                <Select {...fieldProps('voucher_type_id')} {...register('voucher_type_id')}>
                  <option value="">{options.voucher_types.length ? 'Choose… (optional)' : 'None set up yet'}</option>
                  {options.voucher_types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell id="v-department_id" label="Department" error={errors.department_id?.message}>
                <Select {...fieldProps('department_id')} {...register('department_id')}>
                  <option value="">No department</option>
                  {options.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <div className="grid grid-cols-2 gap-3.5">
                <FieldShell id="v-due_date" label="Due date" error={errors.due_date?.message}>
                  <input {...fieldProps('due_date')} {...register('due_date')} type="date" />
                </FieldShell>
                <FieldShell id="v-priority" label="Priority" error={errors.priority?.message}>
                  <Select {...fieldProps('priority')} {...register('priority')}>
                    {options.priorities.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p] ?? p}
                      </option>
                    ))}
                  </Select>
                </FieldShell>
              </div>
              <div className="sm:col-span-2">
                <FieldShell id="v-description" label="What is it for" error={errors.description?.message}>
                  <textarea
                    {...fieldProps('description')}
                    {...register('description')}
                    rows={2}
                    maxLength={2000}
                    placeholder="e.g. November internet bill for the Makati office"
                    className={cn(inputClass, 'h-auto resize-y py-2')}
                  />
                </FieldShell>
              </div>
              <FieldShell id="v-purpose" label="Purpose / notes for the reviewer" error={errors.purpose?.message}>
                <textarea
                  {...fieldProps('purpose')}
                  {...register('purpose')}
                  rows={2}
                  maxLength={2000}
                  className={cn(inputClass, 'h-auto resize-y py-2')}
                />
              </FieldShell>
              <FieldShell id="v-reference_number" label="Reference (invoice / OR number)" error={errors.reference_number?.message}>
                <input {...fieldProps('reference_number')} {...register('reference_number')} maxLength={100} placeholder="e.g. INV-55621" />
              </FieldShell>
            </div>
          </Card>

          <Card title="Payment">
            <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-2">
              {options.payment_methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={method === m}
                  disabled={Boolean(busy)}
                  onClick={() => setValue('payment_method', m, { shouldDirty: true, shouldValidate: true })}
                  className={cn(
                    'text-body-strong flex h-9 items-center gap-1.5 rounded-full border px-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    method === m ? 'border-primary bg-primary-faint text-primary' : 'bg-card hover:bg-muted',
                  )}
                >
                  {m === 'bank' && <Banknote className="size-4" aria-hidden="true" />}
                  {PAYMENT_LABELS[m] ?? m}
                </button>
              ))}
            </div>
            {errors.payment_method && <p className="text-caption text-danger">{errors.payment_method.message}</p>}
            {method === 'bank' && (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <FieldShell id="v-bank_name" label="Bank" error={errors.bank_name?.message}>
                  <input {...fieldProps('bank_name')} {...register('bank_name')} maxLength={150} placeholder="e.g. BPI" />
                </FieldShell>
                <FieldShell id="v-bank_account_name" label="Account name" error={errors.bank_account_name?.message}>
                  <input {...fieldProps('bank_account_name')} {...register('bank_account_name')} maxLength={150} />
                </FieldShell>
                <FieldShell id="v-bank_account_number" label="Account number" error={errors.bank_account_number?.message}>
                  <input {...fieldProps('bank_account_number')} {...register('bank_account_number')} inputMode="numeric" maxLength={50} />
                </FieldShell>
              </div>
            )}
          </Card>

          <Card title="Lines" aside={<span className="text-caption">{fields.length} of 50</span>}>
            {errors.line_items?.message && <p className="text-caption text-danger">{errors.line_items.message}</p>}
            {errors.line_items?.root?.message && <p className="text-caption text-danger">{errors.line_items.root.message}</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="text-table-head text-muted-foreground">
                    <th className="pb-2 font-semibold">Description</th>
                    <th className="w-[90px] pb-2 font-semibold">Qty</th>
                    <th className="w-[90px] pb-2 font-semibold">Unit</th>
                    <th className="w-[140px] pb-2 font-semibold">Unit price (₱)</th>
                    <th className="w-[130px] pb-2 text-right font-semibold">Total</th>
                    <th className="w-10 pb-2">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => {
                    const e = errors.line_items?.[i]
                    return (
                      <tr key={f.id} className="align-top">
                        <td className="py-1 pr-2">
                          <input
                            {...fieldProps(`line_items.${i}.description`)}
                            {...register(`line_items.${i}.description`)}
                            aria-label={`Line ${i + 1} description`}
                            maxLength={255}
                          />
                          {e?.description && <p className="text-caption mt-1 text-danger">{e.description.message}</p>}
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            {...fieldProps(`line_items.${i}.quantity`)}
                            {...register(`line_items.${i}.quantity`)}
                            aria-label={`Line ${i + 1} quantity`}
                            inputMode="decimal"
                          />
                          {e?.quantity && <p className="text-caption mt-1 text-danger">{e.quantity.message}</p>}
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            {...fieldProps(`line_items.${i}.unit`)}
                            {...register(`line_items.${i}.unit`)}
                            aria-label={`Line ${i + 1} unit`}
                            maxLength={30}
                            placeholder="pc"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            {...fieldProps(`line_items.${i}.unit_price`)}
                            {...register(`line_items.${i}.unit_price`)}
                            aria-label={`Line ${i + 1} unit price`}
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                          {e?.unit_price && <p className="text-caption mt-1 text-danger">{e.unit_price.message}</p>}
                        </td>
                        <td className="text-body-strong py-3 pr-2 text-right tabular-nums">
                          {formatMoney(centsToAmount(lineCents(lines?.[i]?.quantity, lines?.[i]?.unit_price)))}
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            disabled={Boolean(busy)}
                            aria-label={`Remove line ${i + 1}`}
                            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <button
                type="button"
                onClick={() => append({ ...EMPTY_LINE })}
                disabled={fields.length >= 50 || Boolean(busy)}
                className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" /> Add line
              </button>
              <p className="text-body">
                Total <span className="text-stat-value ml-2 tabular-nums">{formatMoney(centsToAmount(totalCents))}</span>
              </p>
            </div>
          </Card>

          {!isReturned && (
            <p className="text-caption flex items-center gap-1.5">
              <Info className="size-3.5" aria-hidden="true" /> Attachments (receipts, invoices) come in an upcoming update.
            </p>
          )}
        </div>
        {isReturned && <ReturnSummary voucher={voucher} totalCents={totalCents} lineCount={fields.length} />}
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

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <Link
          to={isReturned ? PATHS.CLERK_RETURNED : voucher ? `${PATHS.CLERK_VOUCHERS}/${voucher.id}` : PATHS.CLERK_VOUCHERS}
          className="text-body-strong mr-auto h-[38px] rounded-lg px-2 leading-[38px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Link>
        {autoOn && <AutoSaveHint auto={auto} onReload={onReload} />}
        <SaveButton busy={busy} onClick={() => run('save')} label={isReturned ? 'Save changes' : 'Save draft'} />
        <SubmitButton busy={busy} onClick={() => run('submit')} label={isReturned ? 'Resubmit for review' : 'Save & submit'} />
      </div>
    </form>
  )
}

/** The auto-save status next to the buttons: always says honestly whether the latest typing is saved. */
function AutoSaveHint({ auto, onReload }) {
  const base = 'text-caption flex items-center gap-1.5'
  switch (auto.state) {
    case 'saving':
      return (
        <span className={base} role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…
        </span>
      )
    case 'saved':
      return (
        <span className={cn(base, 'text-success')} role="status">
          <Check className="size-3.5" aria-hidden="true" /> Saved as a draft · {formatDate(auto.at, 'h:mm a')}
        </span>
      )
    case 'waiting':
      return (
        <span className={base} role="status">
          Not auto-saved yet: choose a category and finish each line
        </span>
      )
    case 'failed':
      return (
        <span className={cn(base, 'text-danger')} role="status">
          Couldn’t auto-save. Click Save draft to see why.
        </span>
      )
    case 'conflict':
      return (
        <span className={cn(base, 'text-danger')} role="alert">
          Changed in another window, so auto-save stopped.
          <button type="button" onClick={onReload} className="text-auth-link text-primary hover:underline">
            Load the latest
          </button>
        </span>
      )
    default:
      return <span className={base}>Auto-saves every 30 seconds</span>
  }
}

function SaveButton({ busy, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(busy)}
      className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {busy === 'save' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  )
}

function SubmitButton({ busy, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(busy)}
      className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {busy === 'submit' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
      {label}
    </button>
  )
}

function Card({ title, aside, children }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
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

/** The saved payee whose name matches what's typed (ignoring letter case and outer spaces), if any. */
function findPayee(payees, name) {
  const n = (name ?? '').trim().toLowerCase()
  return n ? (payees ?? []).find((p) => p.name.toLowerCase() === n) : undefined
}

/** What picking a saved payee fills in: its name, and its type / bank details where the form is empty. */
function payeeFill(payee, values) {
  const fill = { payee_name: payee.name }
  if (!values.payee_email && payee.email) fill.payee_email = payee.email
  if (!values.payee_type_id && payee.payee_type_id) fill.payee_type_id = payee.payee_type_id
  if (payee.default_payment_method) fill.payment_method = payee.default_payment_method
  if (payee.default_payment_method === 'bank') {
    if (!values.bank_name && payee.bank_name) fill.bank_name = payee.bank_name
    if (!values.bank_account_number && payee.bank_account_number) fill.bank_account_number = payee.bank_account_number
    if (!values.bank_account_name && payee.bank_account_name) fill.bank_account_name = payee.bank_account_name
  }
  return fill
}

/** errors.line_items.0.quantity → the error object (react-hook-form keeps nested errors). */
function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ChevronDown, Sparkles, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { useDebounce } from '@/hooks/useDebounce'
import { formatMoney, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { generateReport, previewReport } from '../api'
import { monthChoices, quarterChoices } from '../utils'

const TYPES = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'custom', label: 'Department' },
]

const schema = z
  .object({
    type: z.enum(['monthly', 'quarterly', 'custom']),
    period: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    department_id: z.string().optional(),
    summary: z.boolean(),
    breakdown: z.boolean(),
    flagged: z.boolean(),
    forecast: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'custom') {
      if (!v.department_id) ctx.addIssue({ code: 'custom', path: ['department_id'], message: 'Pick the department this report is for.' })
      if (!v.from) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Pick the first day.' })
      if (!v.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'Pick the last day.' })
      if (v.from && v.to && v.to < v.from)
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'The last day must be on or after the first day.' })
    } else if (!v.period) ctx.addIssue({ code: 'custom', path: ['period'], message: 'Pick the period.' })
  })

/** form values → API body */
function toBody(v) {
  const body = { type: v.type, includes: { summary: v.summary, breakdown: v.breakdown, flagged: v.flagged, forecast: v.forecast } }
  if (v.type === 'custom') Object.assign(body, { from: v.from, to: v.to })
  else body.period = v.period
  if (v.department_id) body.department_id = Number(v.department_id)
  return body
}

/**
 * GENERATE FINANCIAL REPORT (Framer ZoAX4DKjk), 2026-11-27. Type (Monthly / Quarterly / Department), period,
 * department, what to include, and a live line "186 approved vouchers · ₱1,284,560 will be included".
 * The AI summary option is off and explained when OpenAI isn't set up (ai.configured) or is paused at the cap.
 * Success: toast + onCreated(report) (the page opens it; the summary fills in by itself).
 */
export default function GenerateReportModal({ departments, ai, onClose, onCreated }) {
  const months = useMemo(() => monthChoices(), [])
  const quarters = useMemo(() => quarterChoices(), [])
  const today = new Date().toISOString().slice(0, 10)
  const aiUsable = ai?.configured && !ai?.paused
  const [formError, setFormError] = useState(null)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'monthly',
      period: months[1]?.value, // last full month
      from: '',
      to: today,
      department_id: '',
      summary: Boolean(aiUsable),
      breakdown: true,
      flagged: true,
      forecast: false,
    },
  })
  const values = useWatch({ control })
  const type = values.type

  // the live "will be included" line
  const previewKey = useDebounce(JSON.stringify(toBody(values)), 350)
  const [preview, setPreview] = useState({ key: null, data: null, error: null })
  useEffect(() => {
    const body = JSON.parse(previewKey)
    if (body.type === 'custom' ? !body.from || !body.to : !body.period) return undefined
    const ctrl = new AbortController()
    const { includes, ...params } = body // eslint-disable-line no-unused-vars
    previewReport(params, { signal: ctrl.signal })
      .then((data) => setPreview({ key: previewKey, data, error: null }))
      .catch((error) => !ctrl.signal.aborted && setPreview({ key: previewKey, data: null, error }))
    return () => ctrl.abort()
  }, [previewKey])

  const pickType = (t) => {
    setValue('type', t, { shouldDirty: true })
    setValue('period', t === 'quarterly' ? quarters[1]?.value : t === 'monthly' ? months[1]?.value : undefined)
  }

  const save = handleSubmit(async (v) => {
    setFormError(null)
    try {
      const report = await generateReport(toBody(v))
      toast.success(
        report.summary_status === 'queued'
          ? `${report.title} is ready. The AI summary is being written (about 20 seconds).`
          : `${report.title} is ready.`,
      )
      onCreated(report)
    } catch (error) {
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, msgs], i) =>
          setError(field.split('.')[0], { type: 'server', message: msgs[0] }, { shouldFocus: i === 0 }),
        )
      } else setFormError(error)
    }
  })

  const selectWrap = (id, children, invalid) => (
    <div className="relative">
      <select
        id={id}
        {...children.props}
        aria-invalid={invalid ? true : undefined}
        disabled={isSubmitting}
        className={cn(inputClass, 'appearance-none pr-8')}
      >
        {children.options}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )

  return (
    <ModalShell
      title="Generate financial report"
      subtitle="Figures are frozen when it’s made"
      width={540}
      onClose={onClose}
      keepOpenOnBackdrop={isSubmitting}
    >
      <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-label">Report type</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Report type">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={type === t.key}
                  onClick={() => pickType(t.key)}
                  className={cn(
                    'text-body-strong h-10 rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    type === t.key ? 'border-primary bg-primary-faint text-primary' : 'bg-card hover:bg-muted',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {type === 'custom' ? (
              <>
                <FieldShell id="r-from" label="From" required error={errors.from?.message}>
                  <input
                    id="r-from"
                    type="date"
                    max={today}
                    {...register('from')}
                    aria-invalid={errors.from ? true : undefined}
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                </FieldShell>
                <FieldShell id="r-to" label="To" required error={errors.to?.message}>
                  <input
                    id="r-to"
                    type="date"
                    max={today}
                    {...register('to')}
                    aria-invalid={errors.to ? true : undefined}
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                </FieldShell>
              </>
            ) : (
              <FieldShell id="r-period" label="Period" required error={errors.period?.message}>
                {selectWrap(
                  'r-period',
                  {
                    props: register('period'),
                    options: (type === 'quarterly' ? quarters : months).map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    )),
                  },
                  errors.period,
                )}
              </FieldShell>
            )}
            <div className={cn(type === 'custom' && 'sm:col-span-2')}>
              <FieldShell id="r-dept" label="Department" required={type === 'custom'} error={errors.department_id?.message}>
                {selectWrap(
                  'r-dept',
                  {
                    props: register('department_id'),
                    options: [
                      <option key="all" value="">
                        {type === 'custom' ? 'Choose a department…' : 'All departments'}
                      </option>,
                      ...departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      )),
                    ],
                  },
                  errors.department_id,
                )}
              </FieldShell>
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-label mb-1.5">Include</legend>
            <Tick
              label={`AI narrative summary (${ai?.model ?? 'GPT-4o-mini'})`}
              disabled={!aiUsable || isSubmitting}
              {...register('summary')}
            />
            {!ai?.configured && (
              <p className="text-caption -mt-1 pl-7">AI summaries aren’t set up yet (no OpenAI key). The report is made without one.</p>
            )}
            {ai?.configured && ai?.paused && (
              <p className="text-caption -mt-1 pl-7 text-warning">Paused: this month’s OpenAI spend cap is reached.</p>
            )}
            <Tick label="Category and department breakdown" disabled={isSubmitting} {...register('breakdown')} />
            <Tick label="Flagged vouchers list" disabled={isSubmitting} {...register('flagged')} />
            <Tick label="Spending forecast for the next month" disabled={isSubmitting} {...register('forecast')} />
          </fieldset>

          <PreviewLine preview={preview.key === previewKey ? preview : null} summary={values.summary && aiUsable} />

          {formError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="text-body-strong text-danger">Couldn’t generate the report</p>
                <p className="text-caption text-foreground">{formError.message}</p>
                {formError.requestId && <p className="text-caption">Reference: {formError.requestId}</p>}
              </div>
            </div>
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
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <Sparkles className="size-4" aria-hidden="true" /> {isSubmitting ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function Tick({ label, disabled, ...field }) {
  return (
    <label className={cn('flex items-center gap-2.5', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <span className="relative flex size-[18px] shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          {...field}
          className="peer size-[18px] appearance-none rounded-[5px] border bg-card checked:border-primary checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-white peer-checked:block" aria-hidden="true" />
      </span>
      <span className="text-body">{label}</span>
    </label>
  )
}

function PreviewLine({ preview, summary }) {
  if (!preview) return <p className="text-caption rounded-lg bg-muted px-3 py-2.5">Checking what will be included…</p>
  if (preview.error) return <p className="text-caption rounded-lg bg-warning-soft px-3 py-2.5 text-warning">{preview.error.message}</p>
  const p = preview.data
  return (
    <p className="text-caption rounded-lg bg-primary-faint px-3 py-2.5 text-foreground">
      <strong className="font-semibold">
        {formatNumber(p.vouchers)} approved {p.vouchers === 1 ? 'voucher' : 'vouchers'} · {formatMoney(p.total)}
      </strong>{' '}
      will be included ({p.range}).{summary ? ' The AI summary takes about 20 seconds.' : ''}
    </p>
  )
}

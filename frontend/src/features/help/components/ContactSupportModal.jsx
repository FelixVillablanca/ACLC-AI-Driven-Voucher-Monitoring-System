import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ImagePlus, Loader2, Mail, TriangleAlert, X } from 'lucide-react'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import ModalShell from '@/components/common/ModalShell'
import { recentVouchersForSupport } from '@/features/approvals'
import { supervisorVouchersForSupport } from '@/features/supervisor'
import { listVouchers } from '@/features/vouchers'
import { ROLES } from '@/lib/constants'
import { formatBytes } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { getSupportContacts, sendSupportMessage } from '../api'

const MAX_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Contact support (Framer mudjUlcnp), user decisions 2026-11-26: the message goes to the Admin(s) of the
 * company you're working in, as a bell notice and an email (Reply-To = you). An optional screenshot is
 * attached to that email only, never stored.
 * Code differs from the frame: the subtitle names who receives it (the frame promised a reply "within
 * 1 business day" from a support team that doesn't exist); "Related voucher" lists your 20 latest vouchers
 * (an Accounting Officer: the queue + vouchers you reviewed lately; topics come from the server per role, 2026-11-27).
 */
export default function ContactSupportModal({ onClose, defaultTopic = '', defaultVoucherId = null }) {
  const role = useAuthStore((s) => s.user?.role)
  const officer = role === ROLES.OFFICER
  const supervisor = role === ROLES.SUPERVISOR
  const [load, setLoad] = useState({ status: 'loading', contacts: null, vouchers: [], error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const vouchers = supervisor
      ? supervisorVouchersForSupport().catch(() => [])
      : officer
        ? recentVouchersForSupport().catch(() => [])
        : listVouchers({ page: 1 })
            .then((r) => r.vouchers)
            .catch(() => [])
    Promise.all([getSupportContacts(), vouchers])
      .then(([contacts, list]) => alive && setLoad({ status: 'success', contacts, vouchers: list, error: null }))
      .catch((error) => alive && setLoad({ status: 'error', contacts: null, vouchers: [], error }))
    return () => {
      alive = false
    }
  }, [attempt, officer, supervisor])

  const [topic, setTopic] = useState(defaultTopic)
  const [voucherId, setVoucherId] = useState(defaultVoucherId ? String(defaultVoucherId) : '')
  const [message, setMessage] = useState('')
  const [shot, setShot] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(null)
  const fileRef = useRef(null)

  const dirty = Boolean(message.trim() || shot)
  const admins = load.contacts?.admins ?? []

  const pickFile = (file) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) return setErrors((e) => ({ ...e, screenshot: 'Attach a PNG, JPG or WebP image.' }))
    if (file.size > MAX_BYTES) return setErrors((e) => ({ ...e, screenshot: 'The screenshot must be 5 MB or smaller.' }))
    setErrors((e) => ({ ...e, screenshot: undefined }))
    setShot(file)
  }

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (!topic) next.topic = 'Choose a topic.'
    if (message.trim().length < 10)
      next.message = message.trim() ? 'Add a little more detail (at least 10 characters).' : 'Tell us what you need help with.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      setSent(await sendSupportMessage({ topic, message: message.trim(), voucherId: voucherId || null, screenshot: shot }))
    } catch (error) {
      if (error.errors)
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k === 'voucher_id' ? 'voucher' : k, v[0]])))
      else setFormError(error)
    } finally {
      setBusy(false)
    }
  }

  const names = admins.map((a) => a.name).join(' and ')

  return (
    <ModalShell
      title="Contact support"
      subtitle={
        load.status === 'success' && admins.length
          ? `Goes to ${names}, ${admins.length === 1 ? 'the Admin' : 'the Admins'} of ${load.contacts.company}, in ADVMS and by email.`
          : 'Your message goes to your company’s Admin.'
      }
      width={520}
      onClose={onClose}
      keepOpenOnBackdrop={dirty && !sent}
    >
      {load.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 px-6 py-12">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading…</span>
        </div>
      )}

      {load.status === 'error' && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <TriangleAlert className="size-6 text-danger" aria-hidden="true" />
          <p className="text-body-strong">Couldn’t open the support form</p>
          <p className="text-caption">{load.error.message}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-auth-link text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {load.status === 'success' && sent && (
        <>
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-success-soft">
              <CheckCircle2 className="size-7 text-success" aria-hidden="true" />
            </div>
            <p className="text-card-title">Message sent to {names}</p>
            <p className="text-body max-w-sm text-muted-foreground">
              {sent.emailed === sent.admins
                ? 'They got it in their ADVMS notifications and by email. Their reply comes to you by email.'
                : sent.emailed === 0
                  ? 'They got it in their ADVMS notifications. The email couldn’t be sent, so give them a moment to see it there.'
                  : 'They got it in their ADVMS notifications; some emails couldn’t be sent.'}
            </p>
          </div>
          <div className="flex justify-end border-t bg-muted px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Done
            </button>
          </div>
        </>
      )}

      {load.status === 'success' && !sent && (
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-5">
            {admins.length === 0 && (
              <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-warning bg-warning-soft px-3 py-2.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <p className="text-caption text-foreground">
                  {load.contacts.company} has no active Admin yet, so there’s nobody to send this to. Ask your manager.
                </p>
              </div>
            )}

            <FieldShell id="s-topic" label="Topic" required error={errors.topic}>
              <Select id="s-topic" value={topic} onChange={(e) => setTopic(e.target.value)} invalid={Boolean(errors.topic)} disabled={busy}>
                <option value="">Choose…</option>
                {load.contacts.topics.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell
              id="s-voucher"
              label="Related voucher"
              error={errors.voucher}
              hint={
                load.vouchers.length
                  ? undefined
                  : officer
                    ? 'No vouchers in your queue or recent reviews.'
                    : 'You have no vouchers in this company yet.'
              }
            >
              <Select
                id="s-voucher"
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
                invalid={Boolean(errors.voucher)}
                disabled={busy}
              >
                <option value="">None</option>
                {load.vouchers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voucher_number ?? 'Draft'} · {v.payee_name ?? 'Payee not set'}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell id="s-message" label="Message" required error={errors.message}>
              <textarea
                id="s-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={3000}
                disabled={busy}
                aria-invalid={errors.message ? true : undefined}
                placeholder="What happened, and what did you expect?"
                className={cn(inputClass, 'h-auto resize-y py-2')}
              />
            </FieldShell>

            <div className="flex flex-col gap-1.5">
              {shot ? (
                <div className="flex items-center gap-2.5 rounded-[10px] border bg-card px-3 py-2">
                  <ImagePlus className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-body-strong min-w-0 flex-1 truncate">{shot.name}</span>
                  <span className="text-caption">{formatBytes(shot.size)}</span>
                  <button
                    type="button"
                    onClick={() => setShot(null)}
                    aria-label="Remove screenshot"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-[10px] border border-dashed bg-muted px-3 py-2.5 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <ImagePlus className="size-4 text-primary" aria-hidden="true" />
                  <span className="text-auth-link text-primary">Attach a screenshot</span>
                  <span className="text-caption">· optional, up to 5 MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              {errors.screenshot ? (
                <p className="text-caption text-danger">{errors.screenshot}</p>
              ) : (
                <p className="text-caption">It’s attached to the email only and isn’t saved in ADVMS.</p>
              )}
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
              onClick={onClose}
              disabled={busy}
              className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || admins.length === 0}
              className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
              Send message
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

function Select({ invalid, children, ...props }) {
  return (
    <div className="relative">
      <select {...props} aria-invalid={invalid || undefined} className={cn(inputClass, 'appearance-none pr-9')}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}

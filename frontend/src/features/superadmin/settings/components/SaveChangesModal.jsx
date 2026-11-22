import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { saveGlobalSettings } from '../api'
import { impactText, lowersChecks, settingLabel, showValue } from '../utils'

/**
 * "Save N changes to global settings" (G3, frame xICKww9ng, 560px):
 * what's changing (old → new + what it means), an amber note when a change means LESS checking,
 * a required reason (shown in Change history), "Notify all admins", and the Super Admin's password.
 *
 *   changes: [{ key, from, to }]   companies: how many companies the rules apply to
 *   onSaved(result)                onConflict(): someone else saved first → reload the saved values
 * Errors stay inside the dialog: a wrong password or missing reason shows under its field.
 */
export default function SaveChangesModal({ changes, companies, onCancel, onSaved, onConflict }) {
  const [reason, setReason] = useState('')
  const [notifyAdmins, setNotifyAdmins] = useState(true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const n = changes.length
  const warnings = changes.filter(lowersChecks)

  const submit = async () => {
    const local = {}
    if (reason.trim().length < 5) local.reason = 'Say why you are making this change (at least 5 characters).'
    if (!password) local.password = 'Type your password to confirm.'
    setFieldErrors(local)
    if (Object.keys(local).length) return

    setBusy(true)
    setError(null)
    try {
      const result = await saveGlobalSettings({
        changes: changes.map((c) => ({ key: c.key, value: c.to, was: c.from })),
        reason: reason.trim(),
        notifyAdmins,
        password,
      })
      onSaved(result)
    } catch (err) {
      setBusy(false)
      const errors = err.errors ?? {}
      if (errors.password || errors.reason) {
        setFieldErrors({ password: errors.password?.[0], reason: errors.reason?.[0] })
        if (errors.password) setPassword('')
        return
      }
      setError(err)
    }
  }

  const conflict = error?.code === 'SETTINGS_CHANGED'

  return (
    <ConfirmDialog
      title={`Save ${plural(n, 'change', 'changes')} to global settings`}
      description={`They apply to ${companies === 1 ? 'the 1 company' : `all ${companies} companies`} as soon as you save. Check them first.`}
      icon={{ icon: CheckCircle2, tone: 'primary' }}
      confirmLabel={`Save ${plural(n, 'change', 'changes')}`}
      busy={busy}
      error={error}
      onConfirm={submit}
      onCancel={onCancel}
      confirmDisabled={conflict}
      extraAction={conflict ? { label: 'Load their values', onClick: onConflict } : null}
      width={560}
    >
      <section className="flex flex-col gap-2">
        <h3 className="text-table-head text-muted-foreground">What’s changing</h3>
        <ul className="flex flex-col rounded-[10px] border">
          {changes.map((c) => (
            <li key={c.key} className="flex flex-col gap-1 border-b px-3.5 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-body-strong text-foreground">{settingLabel(c.key)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-caption">{showValue(c.key, c.from)}</span>
                  <ArrowRight className="size-3.5" aria-label="becomes" />
                  <span className="text-badge rounded-full bg-primary-soft px-2 py-0.5 text-primary">{showValue(c.key, c.to)}</span>
                </span>
              </div>
              <p className="text-caption">{impactText(c)}</p>
            </li>
          ))}
        </ul>
      </section>

      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-[10px] bg-warning-soft px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-caption text-foreground">
            {warnings.length === 1 ? 'This change means' : 'These changes mean'} fewer vouchers or sign-ins get a second
            check. Make sure Finance and your security lead agree.
          </p>
        </div>
      )}

      <FieldShell
        id="settings-reason"
        label="Reason for the change"
        required
        error={fieldErrors.reason}
        hint="Shown in Change history so others know why."
      >
        <textarea
          id="settings-reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(fieldErrors.reason) || undefined}
          placeholder="e.g. Q4 approval policy update, agreed with Finance on Nov 16."
          className={cn(inputClass, 'h-auto min-h-[72px] resize-y py-2')}
        />
      </FieldShell>

      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" checked={notifyAdmins} onChange={(e) => setNotifyAdmins(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={cn(
            'flex size-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
            notifyAdmins ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
          )}
        >
          {notifyAdmins && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="text-body text-foreground">Notify all admins about this change</span>
      </label>

      <FieldShell
        id="settings-password"
        label="Confirm with your password"
        required
        error={fieldErrors.password}
        hint="We ask again because these rules affect every company."
      >
        <div className="relative">
          <input
            id="settings-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            className={cn(inputClass, 'h-[42px] pr-16')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-auth-link absolute top-1/2 right-3 -translate-y-1/2 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </FieldShell>

      <p className="text-caption">Recorded in the audit log and Change history.</p>
    </ConfirmDialog>
  )
}

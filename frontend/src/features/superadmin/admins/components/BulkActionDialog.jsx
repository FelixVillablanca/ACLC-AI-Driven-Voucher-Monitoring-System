import { useState } from 'react'
import { Check, ChevronDown, CircleX } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { bulkAdminAction } from '../api'
import { announceAdminsChanged } from '../utils'

const TITLES = {
  password_reset: { title: 'Send a password reset to', label: 'Send reset links', tone: 'primary' },
  require_two_factor: { title: 'Require two-step sign-in for', label: 'Require two-step', tone: 'primary' },
  deactivate: { title: 'Deactivate', label: 'Deactivate accounts', tone: 'danger' },
}

/**
 * The "N selected" bar's actions (A6, frame MJPZhmmz3), for several accounts at once.
 * Accounts the action doesn't fit (e.g. yourself, no personal email) are skipped, not failed:
 * the dialog then lists who was skipped and why.
 */
export default function BulkActionDialog({ action, accounts, onCancel, onDone }) {
  const [signOut, setSignOut] = useState(true)
  const [days, setDays] = useState(3)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [skipped, setSkipped] = useState(null) // results that didn't go through

  const meta = TITLES[action]
  const fieldError = error?.errors?.password?.[0]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await bulkAdminAction({
        action,
        ids: accounts.map((a) => a.id),
        password: action === 'deactivate' ? password : undefined,
        setupDays: action === 'require_two_factor' ? days : undefined,
        emailSteps: action === 'require_two_factor' ? true : undefined,
        signOut: action === 'password_reset' ? signOut : undefined,
      })
      announceAdminsChanged()
      if (result.done > 0) toast.success(`Done for ${plural(result.done, 'account', 'accounts')}`)
      if (result.skipped === 0) return onDone()
      setSkipped(result.results.filter((r) => !r.ok))
      setBusy(false)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  if (skipped) {
    return (
      <ConfirmDialog
        title={`${plural(skipped.length, 'account was', 'accounts were')} skipped`}
        confirmLabel="Done"
        onConfirm={onDone}
        onCancel={onDone}
      >
        <ul className="flex flex-col gap-2">
          {skipped.map((r) => (
            <li key={r.id} className="flex items-start gap-2">
              <CircleX className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <span className="text-body-strong text-foreground">{r.name}</span> · {r.message}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    )
  }

  return (
    <ConfirmDialog
      title={`${meta.title} ${plural(accounts.length, 'account', 'accounts')}?`}
      confirmLabel={meta.label}
      tone={meta.tone}
      busy={busy}
      error={error && !fieldError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p className="text-caption">{accounts.map((a) => a.full_name).join(', ')}</p>

      {action === 'password_reset' && (
        <>
          <p>Each gets a one-time link (60 minutes) at their personal email. Accounts without one are skipped.</p>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={signOut}
              onChange={(e) => setSignOut(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                signOut ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
              )}
            >
              {signOut && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span className="text-body text-foreground">Also sign them out everywhere now</span>
          </label>
        </>
      )}

      {action === 'require_two_factor' && (
        <>
          <p>
            At their next sign-in they must set it up. The setup steps are emailed to everyone with a personal email.
          </p>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="bulk-days" className="text-body-strong text-foreground">
              Time to set it up
            </label>
            <div className="relative">
              <select
                id="bulk-days"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className={cn(inputClass, 'w-28 appearance-none pr-8')}
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>
        </>
      )}

      {action === 'deactivate' && (
        <>
          <p>
            They’re signed out everywhere and can’t sign in until reactivated. You and the last Super Admin are always
            skipped.
          </p>
          <FieldShell id="bulk-password" label="Your password" required error={fieldError}>
            <input
              id="bulk-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldError)}
              className={inputClass}
            />
          </FieldShell>
        </>
      )}
    </ConfirmDialog>
  )
}

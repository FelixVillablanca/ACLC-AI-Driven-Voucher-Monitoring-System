import { useState } from 'react'
import { Check, ChevronDown, ShieldCheck } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { cn } from '@/lib/utils'
import { requireTwoFactor } from '../api'
import { announceAdminsChanged } from '../utils'

const SETUP_DAYS = [1, 3, 7]

/**
 * "Require two-step sign-in" (A11, frame x8wWbSPsg): what happens next, how long they have to set
 * it up, and whether to email them the setup steps now.
 */
export default function RequireTwoFactorDialog({ account, onCancel, onDone }) {
  const [days, setDays] = useState(3)
  const [emailSteps, setEmailSteps] = useState(Boolean(account.personal_email))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await requireTwoFactor(account.id, { setupDays: days, emailSteps })
      announceAdminsChanged()
      onDone(
        result.emailed === false
          ? `Two-step is now required for ${account.full_name}, but the setup email could not be sent`
          : `Two-step sign-in is now required for ${account.full_name}${result.emailed ? `. Setup steps sent to ${result.sent_to}` : ''}`,
      )
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          Require two-step sign-in for {account.full_name}?
        </span>
      }
      confirmLabel="Require two-step"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>After their password, they’ll also enter a 6-digit code from an authenticator app.</p>
      <div className="flex flex-col gap-1">
        <p className="text-body-strong text-foreground">What happens next</p>
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>At their next sign-in they must set it up before they can continue.</li>
          <li>They can’t turn it off themselves afterwards.</li>
          <li>You’ll see “✓ On” in the Two-step column once done.</li>
        </ol>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[10px] border bg-muted px-3 py-2.5">
        <div>
          <label htmlFor="setup-days" className="text-body-strong block text-foreground">
            Time to set it up
          </label>
          <span className="text-caption">After this, sign-in is blocked until it’s done.</span>
        </div>
        <div className="relative shrink-0">
          <select
            id="setup-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className={cn(inputClass, 'w-28 appearance-none pr-8')}
          >
            {SETUP_DAYS.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1 day' : `${d} days`}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <label className={cn('flex items-center gap-2.5', account.personal_email ? 'cursor-pointer' : 'opacity-60')}>
        <input
          type="checkbox"
          checked={emailSteps}
          disabled={!account.personal_email}
          onChange={(e) => setEmailSteps(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
            emailSteps ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
          )}
        >
          {emailSteps && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="text-body text-foreground">
          {account.personal_email
            ? `Email them the setup steps now (${account.personal_email})`
            : 'No personal email to send the setup steps to'}
        </span>
      </label>
    </ConfirmDialog>
  )
}

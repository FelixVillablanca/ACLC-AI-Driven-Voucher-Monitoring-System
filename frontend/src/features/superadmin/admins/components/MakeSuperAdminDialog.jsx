import { useState } from 'react'
import { Check, Loader2, Star, TriangleAlert, X } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { cn } from '@/lib/utils'
import { promoteToSuperAdmin } from '../api'
import { useAdminDetail } from '../hooks/useAdminDetail'
import { announceAdminsChanged } from '../utils'

/**
 * "Make Super Admin" (A12, frame QgC8ADhk4). Shows the seats, what they'll be able to do and the
 * checklist. While a check fails the button is greyed out; when only two-step is missing,
 * "Require two-step first" opens that dialog. The password is asked when everything passes.
 */
export default function MakeSuperAdminDialog({ account, onCancel, onDone, onRequireTwoFactor }) {
  const detail = useAdminDetail(account.id)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const promotion = detail.account?.promotion
  const checks = promotion?.checks ?? []
  const allOk = checks.length > 0 && checks.every((c) => c.ok)
  const twoStepMissing = checks.some((c) => c.key === 'two_factor' && !c.ok)
  const fieldError = error?.errors?.password?.[0]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const promoted = await promoteToSuperAdmin(account.id, { password })
      announceAdminsChanged()
      onDone(`${account.full_name} is now a Super Admin (${promoted.email})`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const seatsAfter = promotion ? promotion.seats_used + 1 : null

  return (
    <ConfirmDialog
      title={
        <span className="flex items-center gap-2">
          <Star className="size-5 text-warning" aria-hidden="true" />
          Make {account.full_name} a Super Admin?
        </span>
      }
      confirmLabel="Make Super Admin"
      busy={busy}
      error={error && !fieldError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
      confirmDisabled={!allOk}
      extraAction={
        twoStepMissing && detail.account?.actions?.require_two_factor
          ? { label: '⛨ Require two-step first', onClick: () => onRequireTwoFactor(account) }
          : null
      }
      width={500}
    >
      {detail.status === 'loading' && (
        <div role="status" className="flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Checking…</span>
        </div>
      )}
      {detail.status === 'error' && (
        <ErrorState
          title="Couldn't check this account"
          message={detail.error.message}
          requestId={detail.error.requestId}
          onRetry={detail.reload}
          className="p-2"
        />
      )}

      {promotion && (
        <>
          <p>
            Super Admins own the whole platform. Their email moves to{' '}
            <strong className="font-medium text-foreground">{promotion.new_email}</strong>, they leave their company, and they’re signed out
            once.
          </p>

          <div className="flex items-center justify-between gap-3 rounded-[10px] border bg-muted px-3 py-2.5">
            <span className="text-body-strong text-foreground">Super Admin seats</span>
            <span className="text-caption text-right">
              {promotion.seats_used} of {promotion.seats_total} used now
              {seatsAfter === promotion.seats_total && ' · this uses the last one'}
            </span>
          </div>

          <div>
            <p className="text-body-strong text-foreground">They’ll be able to</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>Add, change and remove every admin</li>
              <li>Change global settings for every company</li>
              <li>Suspend or reactivate companies</li>
            </ul>
          </div>

          {promotion.company_left_without_admin && detail.account.company && (
            <p className="text-caption flex items-start gap-2 rounded-[10px] border border-warning/20 bg-warning-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
              {detail.account.company.name} will have no Admin left. Add a new Admin for it afterwards.
            </p>
          )}

          <div>
            <p className="text-body-strong text-foreground">Before you can continue</p>
            <ul className="mt-1 space-y-1">
              {checks.map((check) => (
                <li key={check.key} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                      check.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                    )}
                  >
                    {check.ok ? (
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <X className="size-3" strokeWidth={3} aria-hidden="true" />
                    )}
                  </span>
                  <span className={check.ok ? undefined : 'text-danger'}>{check.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {allOk && (
            <FieldShell id="promote-password" label="Your password" required error={fieldError}>
              <input
                id="promote-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldError)}
                className={inputClass}
              />
            </FieldShell>
          )}
        </>
      )}
    </ConfirmDialog>
  )
}

import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { deactivateAccount } from '../api'
import { announceAdminsChanged } from '../utils'

/**
 * "Deactivate account" confirm (Admins ⋯ menu A7, Security alert detail). Decided 2026-11-21:
 * one action (it used to be "Lock"). Deactivating is SENSITIVE (spec §4), so the Super Admin
 * types their own password. A wrong password shows under the field.
 *   account: { id, full_name }    alertId: the security alert it came from (it gets marked reviewed)
 */
export default function DeactivateAccountDialog({ account, alertId = null, onCancel, onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const fieldError = error?.errors?.password?.[0]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await deactivateAccount(account.id, { password, alertId })
      announceAdminsChanged()
      onDone(`${account.full_name}'s account is deactivated`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Deactivate ${account.full_name}'s account?`}
      confirmLabel="Deactivate account"
      tone="danger"
      busy={busy}
      error={error && !fieldError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>They’re signed out on every device right away.</li>
        <li>They can’t sign in until a Super Admin reactivates the account. Nothing they made is deleted.</li>
        <li>{alertId ? 'This alert is marked as reviewed, and the' : 'The'} other Super Admins are told.</li>
      </ul>
      <FieldShell id="deactivate-password" label="Your password" required error={fieldError}>
        <input
          id="deactivate-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(fieldError)}
          className={inputClass}
        />
      </FieldShell>
    </ConfirmDialog>
  )
}

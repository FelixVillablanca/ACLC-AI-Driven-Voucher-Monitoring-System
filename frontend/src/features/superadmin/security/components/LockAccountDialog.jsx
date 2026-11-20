import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { lockAdminAccount } from '../api'

/**
 * "Lock account" confirm. Locking works like deactivating, which the spec (§4) treats as
 * SENSITIVE, so the Super Admin types their own password. A wrong password shows under the field.
 */
export default function LockAccountDialog({ alert, onCancel, onDone }) {
  const account = alert.account
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const fieldError = error?.errors?.password?.[0]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await lockAdminAccount(account.id, { password, alertId: alert.id })
      onDone(`${account.full_name}'s account is locked`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Lock ${account.full_name}'s account?`}
      confirmLabel="Lock account"
      tone="danger"
      busy={busy}
      error={error && !fieldError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>They're signed out on every device right away.</li>
        <li>They can't sign in until a Super Admin unlocks the account.</li>
        <li>This alert is marked as reviewed, and the other Super Admins are told.</li>
      </ul>
      <FieldShell id="lock-password" label="Your password" required error={fieldError}>
        <input
          id="lock-password"
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

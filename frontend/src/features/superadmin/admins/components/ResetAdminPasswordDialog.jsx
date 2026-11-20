import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { resetAdminPassword } from '../api'
import { announceAdminsChanged } from '../utils'

/**
 * "Reset password" confirm: a one-time link goes to the Admin's personal email.
 *   account: { id, full_name, personal_email }    alertId: optional security alert to mark reviewed
 */
export default function ResetAdminPasswordDialog({ account, alertId = null, onCancel, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const sentTo = await resetAdminPassword(account.id, { alertId })
      announceAdminsChanged()
      onDone(`Reset link sent to ${sentTo}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Reset ${account.full_name}'s password?`}
      confirmLabel="Send reset link"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>
          We email a one-time link to <strong className="font-medium text-foreground">{account.personal_email}</strong>. It
          works for 60 minutes.
        </li>
        <li>Their current password stops working right away, and they're signed out everywhere.</li>
        <li>You never see their new password.</li>
      </ul>
    </ConfirmDialog>
  )
}

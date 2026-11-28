import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { resendInvitation } from '../api'
import { announceAdminsChanged } from '../utils'

/** "Resend invitation" confirm, for an Admin who hasn't set a password yet. account: { id, full_name, personal_email } */
export default function ResendInvitationDialog({ account, onCancel, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const sentTo = await resendInvitation(account.id)
      announceAdminsChanged()
      onDone(`A new invitation was sent to ${sentTo}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Resend ${account.full_name}'s invitation?`}
      confirmLabel="Send new link"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>
          We email a new "set your password" link to <strong className="font-medium text-foreground">{account.personal_email}</strong>. It
          works for 72 hours.
        </li>
        <li>The link sent earlier stops working.</li>
      </ul>
    </ConfirmDialog>
  )
}

import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { cancelInvitation } from '../api'
import { announceAdminsChanged } from '../utils'

/** "Cancel invite" (A5). Decided 2026-11-21: deletes the never-used account, so the email is free again. */
export default function CancelInviteDialog({ account, onCancel, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await cancelInvitation(account.id)
      announceAdminsChanged()
      onDone(`The invitation for ${account.full_name} was cancelled`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Cancel ${account.full_name}'s invitation?`}
      confirmLabel="Cancel invite"
      tone="danger"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>The account is deleted and their “set your password” link stops working.</li>
        <li>
          <strong className="font-medium text-foreground">{account.email}</strong> becomes free, so you can invite them
          again (for example after a typo).
        </li>
        <li>A record stays in the audit log, and the other Super Admins are told.</li>
      </ul>
    </ConfirmDialog>
  )
}

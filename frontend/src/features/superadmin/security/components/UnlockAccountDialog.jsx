import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { unlockAdminAccount } from '../api'

/** "Unlock account" confirm (undoes Lock). */
export default function UnlockAccountDialog({ account, onCancel, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await unlockAdminAccount(account.id)
      onDone(`${account.full_name}'s account is unlocked`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Unlock ${account.full_name}'s account?`}
      confirmLabel="Unlock account"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>They can sign in again with their current password. If you also reset it, they need the emailed link first.</p>
    </ConfirmDialog>
  )
}

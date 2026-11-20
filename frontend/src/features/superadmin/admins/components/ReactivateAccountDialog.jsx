import { useState } from 'react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { reactivateAccount } from '../api'
import { announceAdminsChanged } from '../utils'

/** "Reactivate account" confirm (undoes Deactivate). account: { id, full_name } */
export default function ReactivateAccountDialog({ account, onCancel, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await reactivateAccount(account.id)
      announceAdminsChanged()
      onDone(`${account.full_name}'s account is active again`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Reactivate ${account.full_name}'s account?`}
      confirmLabel="Reactivate account"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>
        They can sign in again with their current password. If their password was reset, they need the emailed link
        first.
      </p>
    </ConfirmDialog>
  )
}

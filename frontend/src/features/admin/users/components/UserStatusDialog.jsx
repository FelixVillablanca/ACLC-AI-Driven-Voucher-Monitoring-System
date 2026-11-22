import { useState } from 'react'
import { RotateCcw, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { setUserActive } from '../api'
import { announceUsersChanged } from '../utils'

/**
 * "Deactivate Maria Lopez?" / "Reactivate Maria Lopez?". Never deletes: their vouchers and history stay.
 * Deactivated = can't sign in, signed out everywhere right away. Render inside <AnimatePresence>.
 */
export default function UserStatusDialog({ user, onClose }) {
  const deactivating = user.status !== 'inactive'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await setUserActive(user.id, !deactivating, reason.trim())
      announceUsersChanged()
      toast.success(deactivating ? `${user.full_name} was deactivated and signed out.` : `${user.full_name} can sign in again.`)
      onClose()
    } catch (err) {
      if (err.status === 409) announceUsersChanged() // someone else did it already: show the real state
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={deactivating ? { icon: UserX, tone: 'danger' } : { icon: RotateCcw, tone: 'success' }}
      title={deactivating ? `Deactivate ${user.full_name}?` : `Reactivate ${user.full_name}?`}
      description={`${ROLE_LABELS[user.role] ?? user.role} · ${user.email}`}
      confirmLabel={deactivating ? 'Deactivate account' : 'Reactivate account'}
      tone={deactivating ? 'danger' : 'primary'}
      width={480}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <ul
        className={cn(
          'text-caption flex flex-col gap-1.5 rounded-[10px] px-3.5 py-3 text-foreground',
          deactivating ? 'bg-danger-soft' : 'bg-success-soft',
        )}
      >
        {deactivating ? (
          <>
            <li>• They can't sign in, and are signed out everywhere right away</li>
            <li>• Their vouchers and history stay as they are</li>
            <li>• You can reactivate the account any time</li>
          </>
        ) : (
          <>
            <li>• They can sign in again with their current password</li>
            <li>• Their role, department and company access are unchanged</li>
          </>
        )}
      </ul>

      {deactivating && (
        <FieldShell id="user-status-reason" label="Reason (optional)" hint="Saved in the audit log and shown to the other Admins.">
          <input
            id="user-status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            disabled={busy}
            placeholder="e.g. Left the company"
            className={inputClass}
          />
        </FieldShell>
      )}
    </ConfirmDialog>
  )
}

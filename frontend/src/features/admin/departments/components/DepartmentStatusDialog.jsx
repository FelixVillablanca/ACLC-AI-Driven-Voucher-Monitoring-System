import { useState } from 'react'
import { Power, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { setDepartmentActive } from '../api'
import { announceDepartmentsChanged } from '../utils'

/**
 * "Deactivate Finance?" / "Reactivate Finance?". A department is never deleted (vouchers and history
 * point at it). Deactivated = hidden from the choices for new users; the people in it stay in it.
 * Render it inside <AnimatePresence>.
 */
export default function DepartmentStatusDialog({ department, onClose }) {
  const deactivating = department.is_active
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const people = department.people_count ?? 0

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await setDepartmentActive(department.id, !deactivating, reason.trim())
      announceDepartmentsChanged()
      toast.success(deactivating ? `${department.name} was deactivated.` : `${department.name} is active again.`)
      onClose()
    } catch (err) {
      // 409 = someone else already did it: refresh the list so it shows the real state
      if (err.status === 409) announceDepartmentsChanged()
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={deactivating ? { icon: Power, tone: 'warning' } : { icon: RotateCcw, tone: 'success' }}
      title={deactivating ? `Deactivate ${department.name}?` : `Reactivate ${department.name}?`}
      description={`${department.code} · ${plural(people, 'person', 'people')}`}
      confirmLabel={deactivating ? 'Deactivate department' : 'Reactivate department'}
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
          deactivating ? 'bg-warning-soft' : 'bg-success-soft',
        )}
      >
        {deactivating ? (
          <>
            <li>• It can't be chosen for new users any more</li>
            <li>• {people > 0 ? `The ${plural(people, 'person', 'people')} in it stay in it` : 'Nobody is in it right now'}</li>
            <li>• Nothing is deleted. You can reactivate it any time</li>
          </>
        ) : (
          <>
            <li>• It can be chosen for new users again</li>
            <li>• Its people and history are just as they were</li>
          </>
        )}
      </ul>

      {deactivating && (
        <FieldShell id="dept-status-reason" label="Reason (optional)" hint="Saved in the audit log and shown to the other Admins.">
          <input
            id="dept-status-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            disabled={busy}
            placeholder="e.g. Merged into Accounting"
            className={inputClass}
          />
        </FieldShell>
      )}
    </ConfirmDialog>
  )
}

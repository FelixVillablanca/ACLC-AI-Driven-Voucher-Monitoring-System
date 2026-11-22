import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { ROLE_LABELS } from '@/lib/constants'
import { revokeCompanyAccess } from '../api'
import { announceAccessChanged } from '../utils'

/**
 * "Remove Maria Lopez's access to Apex?". The account stays; only this company's access goes.
 * A person of your own company then can't work until it's granted again (Grant company access).
 * Render inside <AnimatePresence>.
 */
export default function RemoveAccessDialog({ person, companyName, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const guest = Boolean(person.home_company)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await revokeCompanyAccess(person.id, reason.trim())
      announceAccessChanged()
      toast.success(`${person.full_name} can no longer open ${companyName}.`)
      onClose()
    } catch (err) {
      if (err.status === 409 || err.status === 404) announceAccessChanged() // the list was out of date
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={{ icon: ShieldOff, tone: 'danger' }}
      title={`Remove ${person.full_name}'s access?`}
      description={`${ROLE_LABELS[person.role] ?? person.role} · ${person.email}`}
      confirmLabel="Remove access"
      tone="danger"
      width={480}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <ul className="text-caption flex flex-col gap-1.5 rounded-[10px] bg-danger-soft px-3.5 py-3 text-foreground">
        <li>• They can no longer open {companyName} or its vouchers</li>
        {guest ? (
          <li>
            • They keep their own company ({person.home_company.name}); only access to {companyName} goes
          </li>
        ) : (
          <li>• {companyName} is their own company, so they can't work until you grant access again</li>
        )}
        <li>• Their account, vouchers and history stay. You can grant access again any time</li>
      </ul>

      <FieldShell id="remove-access-reason" label="Reason (optional)" hint="Saved in the audit log and shown to the other Admins.">
        <input
          id="remove-access-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          disabled={busy}
          placeholder="e.g. Moved to another company"
          className={inputClass}
        />
      </FieldShell>
    </ConfirmDialog>
  )
}

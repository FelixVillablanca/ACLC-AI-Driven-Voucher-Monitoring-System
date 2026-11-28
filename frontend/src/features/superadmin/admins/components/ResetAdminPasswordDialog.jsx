import { useState } from 'react'
import { Check } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { cn } from '@/lib/utils'
import { resetAdminPassword } from '../api'
import { announceAdminsChanged } from '../utils'

/**
 * "Send a password reset" (A10, frame moe5n7c5C). Decided 2026-11-21: the link goes to the
 * PERSONAL email (the work address isn't a mailbox), and "Also sign them out everywhere now"
 * is a tick box (on by default).
 *   account: { id, full_name, personal_email }    alertId: optional security alert to mark reviewed
 */
export default function ResetAdminPasswordDialog({ account, alertId = null, onCancel, onDone }) {
  const [signOut, setSignOut] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const sentTo = await resetAdminPassword(account.id, { alertId, signOut })
      announceAdminsChanged()
      onDone(`Reset link sent to ${sentTo}${signOut ? '. They were signed out everywhere.' : ''}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={`Send a password reset to ${account.full_name}?`}
      confirmLabel="Send reset link"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <p>
        We’ll email a reset link to <strong className="font-medium text-foreground">{account.personal_email}</strong>. It works once and
        expires in 60 minutes.
      </p>
      <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border bg-muted px-3 py-2.5">
        <input type="checkbox" checked={signOut} onChange={(e) => setSignOut(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
            signOut ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
          )}
        >
          {signOut && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span>
          <span className="text-body-strong block text-foreground">Also sign them out everywhere now</span>
          <span className="text-caption">
            Use this if you think someone else knows the password. Their old password stops working right away.
          </span>
        </span>
      </label>
      <p className="text-caption">You never see or choose their new password. The reset is recorded in the audit log.</p>
    </ConfirmDialog>
  )
}

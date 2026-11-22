import { useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { generatePassword } from '@/lib/password'
import { setUserPassword } from '../api'
import { announceUsersChanged } from '../utils'
import PasswordGenerator from './PasswordGenerator'

/**
 * "Set a new password for Maria Lopez?" (Users page). Same idea as Create user: the password is
 * generated here, the Admin gives it to the person, and the person is signed out everywhere.
 * After saving, the dialog stays open on a "Saved" step so the password can still be copied.
 */
export default function SetPasswordDialog({ user, onClose }) {
  const [password, setPassword] = useState(() => generatePassword())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const confirm = async () => {
    if (saved) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setUserPassword(user.id, password)
      announceUsersChanged()
      toast.success(`New password saved for ${user.full_name}.`)
      setSaved(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={saved ? { icon: CheckCircle2, tone: 'success' } : { icon: KeyRound, tone: 'warning' }}
      title={saved ? 'Password changed' : `Set a new password for ${user.full_name}?`}
      description={user.email}
      confirmLabel={saved ? 'Done' : 'Save new password'}
      width={520}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <PasswordGenerator value={password} onGenerate={() => setPassword(generatePassword())} disabled={busy} generateDisabled={saved} />
      <p className="text-caption rounded-[10px] bg-muted px-3.5 py-2.5">
        {saved
          ? 'Copy it now and give it to them in person or by phone. It is not shown again, and it is never emailed.'
          : 'Their old password stops working and they are signed out everywhere. Give them this password so they can sign in.'}
      </p>
    </ConfirmDialog>
  )
}

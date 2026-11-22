import { useId, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { reactivateCompany } from '../api'
import { announceCompaniesChanged, suspendedText } from '../utils'

/**
 * "Reactivate Northfield Academy?" (C7, frame B3zqVOXN4): who suspended it and why, what comes
 * back (green box), an optional note, and whether to email the Admin in charge.
 */
export default function ReactivateCompanyDialog({ company, onCancel, onDone }) {
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(Boolean(company.admin))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const notifyId = useId()

  const noteError = error?.errors?.note?.[0]
  const reason = company.suspension?.reason

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await reactivateCompany(company.id, { note: note.trim(), notifyAdmin: notify })
      announceCompaniesChanged()
      onDone(
        `${company.name} is active again. Everyone can sign in.`,
        result.adminsNotified === false
          ? `The email to ${company.admin?.full_name ?? 'the Admin'} couldn't be sent. Tell them another way.`
          : null,
      )
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={{ icon: RotateCcw, tone: 'success' }}
      title={`Reactivate ${company.name}?`}
      description={[suspendedText(company.suspension), reason && `“${reason}”`].filter(Boolean).join(' · ')}
      confirmLabel="Reactivate company"
      width={500}
      busy={busy}
      error={error && !noteError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="text-caption flex flex-col gap-1.5 rounded-[10px] bg-success-soft px-3.5 py-3 text-foreground">
        <li>• {plural(company.users_count, 'user', 'users')} can sign in again right away</li>
        <li>• Everything continues where it stopped; nothing was deleted</li>
        {company.admin && notify && <li>• {company.admin.full_name} (admin in charge) is notified</li>}
      </ul>

      <FieldShell id="reactivate-note" label="Note (optional)" error={noteError}>
        <textarea
          id="reactivate-note"
          rows={2}
          autoFocus
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Contract renewed on Nov 17"
          aria-invalid={Boolean(noteError)}
          className={cn(inputClass, 'h-auto min-h-16 resize-y py-2.5')}
        />
      </FieldShell>

      {company.admin && (
        <label htmlFor={notifyId} className="text-body flex items-center gap-2 text-foreground">
          <input
            id={notifyId}
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="size-4 accent-primary"
          />
          Email {company.admin.full_name} that the company is active again
        </label>
      )}
    </ConfirmDialog>
  )
}

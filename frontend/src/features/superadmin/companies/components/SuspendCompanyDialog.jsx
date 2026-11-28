import { useId, useState } from 'react'
import { Ban, Check } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { suspendCompany } from '../api'
import { announceCompaniesChanged, confirmWord } from '../utils'

/**
 * "Suspend Apex Holdings Inc.?" (C6, frame eGUijf8Wd). A big, platform-wide step, so:
 *   - what happens is listed in a red box,
 *   - a reason is REQUIRED (it goes into the audit log and the email to the company's Admin),
 *   - the red button only works after typing the company's first word ("APEX").
 * Success → toast + the list refreshes; errors (wrong field, 409 already suspended, network)
 * show inside the dialog so it can be fixed and tried again.
 */
export default function SuspendCompanyDialog({ company, onCancel, onDone }) {
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(Boolean(company.admin))
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const notifyId = useId()

  const word = confirmWord(company.name)
  const matches = typed.trim().toUpperCase() === word
  const reasonError = error?.errors?.reason?.[0]

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await suspendCompany(company.id, { reason, notifyAdmin: notify })
      announceCompaniesChanged()
      onDone(
        `${company.name} is suspended. ${plural(result.signedOut, 'person was', 'people were')} signed out.`,
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
      icon={{ icon: Ban, tone: 'danger' }}
      title={`Suspend ${company.name}?`}
      description="Nobody in this company will be able to sign in until you reactivate it."
      confirmLabel="Suspend company"
      tone="danger"
      width={520}
      busy={busy}
      confirmDisabled={!matches || reason.trim() === ''}
      error={error && !reasonError ? error : null}
      onConfirm={confirm}
      onCancel={onCancel}
    >
      <ul className="text-caption flex flex-col gap-1.5 rounded-[10px] bg-danger-soft px-3.5 py-3 text-foreground">
        <li>• {plural(company.users_count, 'user is', 'users are')} signed out and blocked right away</li>
        <li>• People who also work in another active company keep working there</li>
        <li>• All data is kept; you can reactivate at any time</li>
      </ul>

      <FieldShell
        id="suspend-reason"
        label="Reason"
        required
        error={reasonError}
        hint="Saved in the audit log and shown to the company's admin."
      >
        <textarea
          id="suspend-reason"
          rows={3}
          autoFocus
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Unpaid subscription for October and November."
          aria-invalid={Boolean(reasonError)}
          className={cn(inputClass, 'h-auto min-h-[72px] resize-y py-2.5')}
        />
      </FieldShell>

      <label htmlFor={notifyId} className={cn('text-body flex items-center gap-2 text-foreground', !company.admin && 'opacity-60')}>
        <input
          id={notifyId}
          type="checkbox"
          checked={notify}
          disabled={!company.admin}
          onChange={(e) => setNotify(e.target.checked)}
          className="size-4 accent-primary"
        />
        {company.admin ? `Notify the admin in charge (${company.admin.full_name})` : 'This company has no Admin to notify'}
      </label>

      <FieldShell id="suspend-confirm" label={`Type ${word} to confirm`}>
        <div className="relative">
          <input
            id="suspend-confirm"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={cn(inputClass, 'text-body-strong pr-24 uppercase')}
          />
          {matches && (
            <span className="text-badge absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 text-success">
              <Check className="size-3.5" aria-hidden="true" /> Matches
            </span>
          )}
        </div>
      </FieldShell>
    </ConfirmDialog>
  )
}

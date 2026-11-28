import { useEffect, useState } from 'react'
import { Building2, Loader2, RotateCcw, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { getOtherCompanies, removeFromYourCompany, setUserActive } from '../api'
import { announceUsersChanged } from '../utils'

/**
 * "Deactivate Maria Lopez?" / "Reactivate Maria Lopez?". Never deletes: their vouchers and history stay.
 * Deactivated = the WHOLE account: can't sign in, signed out everywhere right away (user decision 2026-11-28).
 * If they also work in other companies, the dialog lists them and offers a second choice: only remove them from
 * your company (Remove access), so they keep working in the others. Those companies' Admins are told either way.
 * Render inside <AnimatePresence>.
 */
export default function UserStatusDialog({ user, onClose }) {
  const deactivating = user.status !== 'inactive'
  const myCompany = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [others, setOthers] = useState({ status: deactivating ? 'loading' : 'ready', companies: [], homeAccess: false })
  const [choice, setChoice] = useState('everywhere') // 'everywhere' | 'here'

  useEffect(() => {
    if (!deactivating) return undefined
    let cancelled = false
    getOtherCompanies(user.id)
      .then((r) => !cancelled && setOthers({ status: 'ready', ...r }))
      .catch(() => !cancelled && setOthers({ status: 'error', companies: [], homeAccess: false }))
    return () => {
      cancelled = true
    }
  }, [deactivating, user.id])

  const shared = others.companies.length > 0
  const onlyHere = deactivating && shared && choice === 'here'

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      if (onlyHere) {
        await removeFromYourCompany(user.id, reason.trim())
        toast.success(`${user.full_name} no longer has access to ${myCompany}. They keep their other companies.`)
      } else {
        await setUserActive(user.id, !deactivating, reason.trim())
        toast.success(
          deactivating
            ? `${user.full_name} was deactivated and signed out${shared ? `. ${others.companies.map((c) => c.name).join(', ')} ${others.companies.length === 1 ? 'was' : 'were'} told` : ''}.`
            : `${user.full_name} can sign in again.`,
        )
      }
      announceUsersChanged()
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
      confirmLabel={
        !deactivating
          ? 'Reactivate account'
          : onlyHere
            ? `Remove from ${myCompany}`
            : shared
              ? 'Deactivate everywhere'
              : 'Deactivate account'
      }
      tone={deactivating ? 'danger' : 'primary'}
      width={520}
      busy={busy}
      error={error}
      confirmDisabled={deactivating && others.status === 'loading'}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {deactivating && others.status === 'loading' && (
        <p role="status" className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking which companies they work in…
        </p>
      )}

      {deactivating && others.status === 'error' && (
        <p className="text-caption rounded-[10px] bg-warning-soft px-3.5 py-3 text-foreground">
          We couldn’t check whether they also work in other companies. Deactivating still switches off the whole account, in every company.
        </p>
      )}

      {deactivating && shared && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-[10px] border bg-muted px-3.5 py-3">
            <p className="text-badge flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden="true" /> They also work in{' '}
              {others.companies.length === 1 ? 'another company' : `${others.companies.length} other companies`}
            </p>
            <p className="text-caption">{others.companies.map((c) => c.name).join(', ')}</p>
          </div>

          <div role="radiogroup" aria-label="What should happen?" className="flex flex-col gap-2">
            <ChoiceCard
              checked={choice === 'everywhere'}
              onSelect={() => setChoice('everywhere')}
              disabled={busy}
              title="Deactivate everywhere"
              text={`The whole account is switched off: they can’t sign in, so they lose ${others.companies.map((c) => c.name).join(', ')} too. Those companies’ Admins get a notice.`}
            />
            <ChoiceCard
              checked={choice === 'here'}
              onSelect={() => setChoice('here')}
              disabled={busy || !others.homeAccess}
              title={`Only remove them from ${myCompany}`}
              text={
                others.homeAccess
                  ? `They can’t open ${myCompany} any more, but keep signing in and working in their other companies. You can grant access again later.`
                  : `They already have no access to ${myCompany}.`
              }
            />
          </div>
        </div>
      )}

      {(!deactivating || !shared || choice === 'everywhere') && (
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
              <li>• Admins of other companies they work in are told</li>
            </>
          )}
        </ul>
      )}

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

function ChoiceCard({ checked, onSelect, disabled, title, text }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-[10px] border px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
        checked ? 'border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
      )}
    >
      <span
        className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', checked && 'border-primary')}
        aria-hidden="true"
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-body-strong">{title}</span>
        <span className="text-caption">{text}</span>
      </span>
    </button>
  )
}

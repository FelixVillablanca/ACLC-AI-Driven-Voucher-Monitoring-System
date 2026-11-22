import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Building2, Check, Inbox, Loader2, Send, UserX, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, formatTimeAgo } from '@/lib/formatters'
import { answerJoinRequest, cancelInvitation } from '../api'
import { usePendingAccess } from '../hooks/usePendingAccess'
import { announceAccessChanged } from '../utils'

/**
 * The Requests tab: people asking to join your company (Approve / Decline) and the invitations you
 * sent to people of other companies (Withdraw). People of other companies show name, role and home
 * company only (privacy rule); your own people also show their work email.
 */
export default function RequestsPanel({ companyName, onInvite }) {
  const pending = usePendingAccess()
  const [declining, setDeclining] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const run = async (id, work, done) => {
    setBusyId(id)
    try {
      await work()
      announceAccessChanged()
      toast.success(done)
    } catch (error) {
      if (error.status === 404) announceAccessChanged() // already answered / withdrawn: show the real state
      toast.error(error.message)
    } finally {
      setBusyId(null)
    }
  }

  if (pending.status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-12">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-caption">Loading requests…</span>
      </div>
    )
  }

  if (pending.status === 'error') {
    return (
      <div className="rounded-xl border bg-card">
        <ErrorState
          title="Couldn't load the requests"
          message={pending.error.message}
          requestId={pending.error.requestId}
          onRetry={pending.reload}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Section title="Asking to join" count={pending.requests.length}>
        {pending.requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No requests"
            description={`Clerks, officers and supervisors who ask to work in ${companyName} show up here.`}
            className="p-8"
          />
        ) : (
          <ul>
            {pending.requests.map((p) => (
              <PersonRow key={p.id} person={p} companyName={companyName} when="asked">
                <button
                  type="button"
                  onClick={() => setDeclining(p)}
                  disabled={busyId === p.id}
                  className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  <X className="size-4" aria-hidden="true" /> Decline
                </button>
                <button
                  type="button"
                  onClick={() => run(p.id, () => answerJoinRequest(p.id, true), `${p.full_name} can now work in ${companyName}.`)}
                  disabled={busyId === p.id}
                  className="text-auth-button flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {busyId === p.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                  Approve
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Invitations you sent"
        count={pending.invites.length}
        action={
          <button type="button" onClick={onInvite} className="text-auth-link flex items-center gap-1 text-primary hover:underline">
            <Send className="size-3.5" aria-hidden="true" /> Invite someone
          </button>
        }
      >
        {pending.invites.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No open invitations"
            description="Invite clerks, officers or supervisors of other companies to work in yours. They accept or decline."
            className="p-8"
          />
        ) : (
          <ul>
            {pending.invites.map((p) => (
              <PersonRow key={p.id} person={p} companyName={companyName} when="invited">
                <button
                  type="button"
                  onClick={() => run(p.id, () => cancelInvitation(p.id), `Invitation to ${p.full_name} withdrawn.`)}
                  disabled={busyId === p.id}
                  className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {busyId === p.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Withdraw
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </Section>

      <AnimatePresence>
        {declining && <DeclineDialog key="decline" person={declining} companyName={companyName} onClose={() => setDeclining(null)} />}
      </AnimatePresence>
    </div>
  )
}

function Section({ title, count, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-card-title">
          {title} <span className="text-caption">· {count}</span>
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function PersonRow({ person, when, children }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span className="text-badge flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        {formatInitials(person)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-strong">{person.full_name}</p>
        <p className="text-caption flex flex-wrap items-center gap-x-1.5">
          <span>{ROLE_SHORT_LABELS[person.role] ?? person.role}</span>
          {person.home_company ? (
            <span className="flex items-center gap-1">
              · <Building2 className="size-3" aria-hidden="true" /> {person.home_company}
            </span>
          ) : (
            person.email && <span>· {person.email}</span>
          )}
          {person.asked_at && (
            <span>
              · {when} {formatTimeAgo(person.asked_at)}
              {when === 'invited' && person.asked_by ? ` by ${person.asked_by}` : ''}
            </span>
          )}
        </p>
        {person.message && <p className="text-body mt-1.5 rounded-lg bg-muted px-3 py-2">“{person.message}”</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </li>
  )
}

function DeclineDialog({ person, companyName, onClose }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await answerJoinRequest(person.id, false, reason.trim())
      announceAccessChanged()
      toast.success(`${person.full_name}'s request was declined.`)
      onClose()
    } catch (err) {
      if (err.status === 404) announceAccessChanged()
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      icon={{ icon: UserX, tone: 'danger' }}
      title={`Decline ${person.full_name}'s request?`}
      description={[ROLE_SHORT_LABELS[person.role], person.home_company].filter(Boolean).join(' · ')}
      confirmLabel="Decline request"
      tone="danger"
      width={460}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      <p className="text-caption rounded-[10px] bg-muted px-3.5 py-3 text-foreground">
        They won't get access to {companyName}. They're told, and can ask again later. Their own company isn't affected.
      </p>
      <FieldShell id="decline-reason" label="Reason (optional)" hint={`Shown to ${person.first_name} and saved in the audit log.`}>
        <input
          id="decline-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          disabled={busy}
          placeholder="e.g. We aren't adding people this month"
          className={inputClass}
        />
      </FieldShell>
    </ConfirmDialog>
  )
}

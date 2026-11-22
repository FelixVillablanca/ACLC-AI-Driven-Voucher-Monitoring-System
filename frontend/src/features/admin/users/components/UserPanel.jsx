import { KeyRound, Loader2, Pencil, RotateCcw, ShieldCheck, UserX } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { ROLE_LABELS } from '@/lib/constants'
import { formatDate, formatInitials } from '@/lib/formatters'
import { useAuthStore } from '@/stores/useAuthStore'
import { useUserDetail } from '../hooks/useUserDetail'
import { lastSignInText, statusPill } from '../utils'

/**
 * A person's side panel (opens with ?user={id}): who they are, role, department, sign-in facts,
 * and the actions. `onAction('edit' | 'status' | 'password', user)`. Render inside <AnimatePresence>.
 */
export default function UserPanel({ id, onClose, onAction }) {
  const companyName = useAuthStore((s) => s.user?.company?.name)
  const detail = useUserDetail(id)
  const u = detail.user
  const inactive = u?.status === 'inactive'

  const footer = u && (
    <>
      <button
        type="button"
        onClick={() => onAction('status', u)}
        className="text-body-strong mr-auto flex h-[38px] items-center gap-1.5 rounded-lg px-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {inactive ? (
          <>
            <RotateCcw className="size-4 text-success" aria-hidden="true" /> <span className="text-success">Reactivate</span>
          </>
        ) : (
          <>
            <UserX className="size-4 text-danger" aria-hidden="true" /> <span className="text-danger">Deactivate</span>
          </>
        )}
      </button>
      {!inactive && (
        <button
          type="button"
          onClick={() => onAction('password', u)}
          className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <KeyRound className="size-4" aria-hidden="true" /> New password
        </button>
      )}
      <button
        type="button"
        onClick={() => onAction('edit', u)}
        className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Pencil className="size-4" aria-hidden="true" /> Edit
      </button>
    </>
  )

  const pill = u && statusPill(u.status)

  return (
    <SidePanel label={u ? u.full_name : 'User'} width={460} onClose={onClose} footer={footer}>
      <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
        <span className="text-badge flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          {u ? formatInitials(u) : ''}
        </span>
        <div className="min-w-0 flex-1">
          {u ? (
            <>
              <p className="text-card-title truncate">{u.full_name}</p>
              <p className="text-caption truncate">{u.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill tone="primary">{ROLE_LABELS[u.role] ?? u.role}</Pill>
                <Pill tone={pill.tone}>{pill.text}</Pill>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          )}
        </div>
        <PanelClose onClick={onClose} />
      </div>

      {detail.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 p-12">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading…</span>
        </div>
      )}

      {detail.status === 'error' && (
        <ErrorState
          title={detail.error.status === 404 ? 'User not found' : "Couldn't load this user"}
          message={detail.error.status === 404 ? "They aren't one of your company's users." : detail.error.message}
          requestId={detail.error.requestId}
          onRetry={detail.error.status === 404 ? undefined : detail.reload}
        />
      )}

      {u && (
        <div className="flex flex-col gap-4 px-6 py-5">
          {inactive && (
            <p className="text-caption rounded-[10px] bg-muted px-3.5 py-2.5">
              Deactivated{u.deactivated_at ? ` on ${formatDate(u.deactivated_at, 'MMM d, yyyy')}` : ''}. They can't sign in until you
              reactivate the account.
            </p>
          )}
          {u.status === 'pending' && (
            <p className="text-caption rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-foreground">
              They haven't signed in yet. If they lost the password, set a new one and give it to them.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Employee ID" value={<span className="font-mono">{u.employee_id ?? '—'}</span>} />
            <Fact label="Company" value={companyName ?? '—'} />
            <Fact
              label="Department"
              value={
                u.department ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {u.department.name}
                    {!u.department.is_active && <Pill tone="neutral">Deactivated</Pill>}
                  </span>
                ) : (
                  <span className="text-warning">None yet</span>
                )
              }
            />
            <Fact label="Last sign-in" value={lastSignInText(u.last_login_at)} />
            <Fact
              label="Two-step sign-in"
              value={
                u.two_factor ? (
                  <span className="flex items-center gap-1 text-success">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> On
                  </span>
                ) : (
                  'Off'
                )
              }
            />
            <Fact label="Added" value={u.created_at ? formatDate(u.created_at, 'MMM d, yyyy') : '—'} />
          </dl>
        </div>
      )}
    </SidePanel>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border bg-muted px-3 py-2">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body-strong">{value}</dd>
    </div>
  )
}

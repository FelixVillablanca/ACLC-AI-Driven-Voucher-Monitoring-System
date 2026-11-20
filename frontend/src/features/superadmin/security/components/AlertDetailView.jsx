import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Info, Loader2, SearchX } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, plural } from '@/lib/formatters'
import { reviewSecurityAlert } from '../api'
import { useSecurityAlert } from '../hooks/useSecurityAlert'
import {
  accountPill,
  alertPill,
  alertTitle,
  announceAlertsChanged,
  dayAndTime,
  detectedLine,
  lastSignInText,
  suggestedStep,
  timelineRows,
} from '../utils'
import LockAccountDialog from './LockAccountDialog'
import PanelCloseButton from './PanelCloseButton'
import ResetPasswordDialog from './ResetPasswordDialog'
import UnlockAccountDialog from './UnlockAccountDialog'

/** "What happened" shows this many rows, then "+ N more attempts". */
const FIRST_ROWS = 3

/**
 * Alert detail (Framer SCoT_cu7B, 480px): "← All alerts", the pill + title + rule,
 * the Account card, "What happened", "Suggested next step", and the footer actions
 * (Mark as reviewed · Reset password · Lock account).
 */
export default function AlertDetailView({ alertId, onBack, onClose }) {
  const detail = useSecurityAlert(alertId)
  const [dialog, setDialog] = useState(null) // 'lock' | 'unlock' | 'reset'
  const [reviewing, setReviewing] = useState(false)

  const refresh = () => {
    announceAlertsChanged()
    return detail.reload({ quiet: true })
  }

  const markReviewed = async () => {
    setReviewing(true)
    try {
      await reviewSecurityAlert(alertId)
      toast.success('Alert marked as reviewed')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setReviewing(false)
      refresh()
    }
  }

  const onDialogDone = (message) => {
    setDialog(null)
    toast.success(message)
    refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2.5 px-5 pt-[18px]">
        <button
          type="button"
          onClick={onBack}
          className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          ← All alerts
        </button>
        <PanelCloseButton onClick={onClose} />
      </div>

      {detail.status === 'loading' && (
        <div role="status" className="flex flex-1 items-center justify-center gap-2">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the alert…</span>
        </div>
      )}

      {detail.status === 'error' && detail.error.status === 404 && (
        <EmptyState
          icon={SearchX}
          title="This alert doesn't exist"
          description="It may have been removed. Go back to see all alerts."
          className="flex-1"
        />
      )}

      {detail.status === 'error' && detail.error.status !== 404 && (
        <ErrorState
          title="Couldn't load this alert"
          message={detail.error.message}
          requestId={detail.error.requestId}
          onRetry={() => detail.reload()}
          className="flex-1"
        />
      )}

      {detail.status === 'success' && (
        <Loaded
          alert={detail.alert}
          reviewing={reviewing}
          onMarkReviewed={markReviewed}
          onOpenDialog={setDialog}
        />
      )}

      <AnimatePresence>
        {detail.alert && dialog === 'lock' && (
          <LockAccountDialog alert={detail.alert} onCancel={() => setDialog(null)} onDone={onDialogDone} />
        )}
        {detail.alert && dialog === 'unlock' && (
          <UnlockAccountDialog account={detail.alert.account} onCancel={() => setDialog(null)} onDone={onDialogDone} />
        )}
        {detail.alert && dialog === 'reset' && (
          <ResetPasswordDialog alert={detail.alert} onCancel={() => setDialog(null)} onDone={onDialogDone} />
        )}
      </AnimatePresence>
    </>
  )
}

function Loaded({ alert, reviewing, onMarkReviewed, onOpenDialog }) {
  const pill = alertPill(alert)
  const open = alert.status === 'open'
  const step = open ? suggestedStep(alert) : null
  const { actions } = alert

  return (
    <>
      <div className="flex flex-col gap-2.5 border-b px-5 pt-2.5 pb-4">
        <Pill tone={pill.tone} className="self-start">
          {pill.text}
        </Pill>
        <h2 className="text-page-title">{alertTitle(alert)}</h2>
        <p className="text-caption">{detectedLine(alert)}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 py-[18px]">
        <AccountSection alert={alert} />
        <WhatHappened alert={alert} />

        {step && (
          <div className="flex flex-col gap-0.5 rounded-[10px] border border-primary-soft bg-primary-faint px-3.5 py-3">
            <p className="text-badge text-primary">Suggested next step</p>
            <p className="text-caption">{step}</p>
          </div>
        )}

        {!open && (
          <div className="flex gap-2 rounded-[10px] border bg-muted px-3.5 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-caption">
              {alert.status === 'dismissed' ? 'Dismissed' : 'Reviewed'}
              {alert.reviewed_by ? ` by ${alert.reviewed_by.full_name}` : ''} {dayAndTime(alert.reviewed_at)}.
            </p>
          </div>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t bg-muted px-5 py-3.5">
        {(actions.account_note || actions.reset_note) && (
          <p className="text-caption">{actions.account_note ?? actions.reset_note}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {actions.review && (
            <FooterButton onClick={onMarkReviewed} busy={reviewing}>
              Mark as reviewed
            </FooterButton>
          )}
          {actions.reset_password && <FooterButton onClick={() => onOpenDialog('reset')}>Reset password</FooterButton>}
          {actions.unlock && <FooterButton onClick={() => onOpenDialog('unlock')}>Unlock account</FooterButton>}
          {actions.lock && (
            <button
              type="button"
              onClick={() => onOpenDialog('lock')}
              className="text-auth-button flex h-[38px] items-center rounded-lg bg-danger px-3.5 text-white outline-none hover:bg-danger/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Lock account
            </button>
          )}
        </div>
      </footer>
    </>
  )
}

function AccountSection({ alert }) {
  const account = alert.account

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-table-head text-muted-foreground">Account</h3>
      {account ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-muted px-3.5 py-3">
          <div className="text-badge flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            {formatInitials(account)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-strong">
              {account.full_name} · {ROLE_SHORT_LABELS[account.role] ?? account.role}
            </p>
            <p className="text-caption break-all">{account.email}</p>
            <p className="text-caption">{lastSignInText(account)}</p>
          </div>
          <Pill tone={accountPill(account.status).tone}>{accountPill(account.status).text}</Pill>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-muted px-3.5 py-3">
          <p className="text-body-strong">No account uses this email</p>
          <p className="text-caption break-all">Typed: {alert.subject_email}</p>
        </div>
      )}
    </section>
  )
}

function WhatHappened({ alert }) {
  const [showAll, setShowAll] = useState(false)
  const rows = timelineRows(alert)
  const visible = showAll ? rows : rows.slice(0, FIRST_ROWS)
  const hidden = rows.length - visible.length
  const notKept = alert.event_count - rows.length // only the last 50 attempts are kept

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-table-head text-muted-foreground">What happened</h3>
      <ul>
        {visible.map((row) => (
          <li key={row.key} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b py-2">
            <span className="text-body-strong w-16 shrink-0 tabular-nums">{row.time}</span>
            <span className="text-body min-w-0 flex-1">{row.text}</span>
            {row.where && <span className="text-caption">{row.where}</span>}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          + {plural(hidden, 'more attempt', 'more attempts')}
        </button>
      )}
      {showAll && notKept > 0 && (
        <p className="text-caption">{plural(notKept, 'older attempt isn’t', 'older attempts aren’t')} listed (the last 50 are kept).</p>
      )}
    </section>
  )
}

function FooterButton({ onClick, busy = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

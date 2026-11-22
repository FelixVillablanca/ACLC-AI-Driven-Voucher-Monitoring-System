import { useEffect, useState } from 'react'
import { AlertTriangle, Ban, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import CheckBoxRow from './CheckBoxRow'
import { formatDate, formatTimeAgo, plural } from '@/lib/formatters'
import { getBlockedIp, unblockIp } from '../api'

/**
 * SH9 "Unblock 180.190.77.4?" (frame BUnDf0lzZ): why it was blocked (by whom, until when, what it
 * did before), an amber warning when it kept trying while blocked, and "Watch it for 24 hours"
 * (3 more failed sign-ins block it again automatically, and you're told).
 *   block: { id, ip_address, … } from the list   onDone(message)
 */
export default function UnblockDialog({ block, onCancel, onDone }) {
  const [details, setDetails] = useState(null)
  const [watch, setWatch] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    getBlockedIp(block.id)
      .then((d) => alive && setDetails(d))
      .catch(() => alive && setDetails({ failed: true }))
    return () => {
      alive = false
    }
  }, [block.id])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await unblockIp(block.id, { watch })
      onDone(`${block.ip_address} is unblocked.${watch ? ' It’s watched for 24 hours.' : ''}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  // days left on the block, worked out once when the dialog opens
  const [daysLeft] = useState(() => (block.until ? Math.ceil((new Date(block.until) - Date.now()) / 864e5) : null))

  return (
    <ConfirmDialog
      title={`Unblock ${block.ip_address}?`}
      description={`Sign-ins from this address will be allowed again right away${daysLeft > 0 ? `, ${plural(daysLeft, 'day', 'days')} before the block ends` : ''}.`}
      icon={{ icon: Ban, tone: 'warning' }}
      confirmLabel="Unblock"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      width={500}
    >
      <section className="flex flex-col gap-1.5 rounded-[10px] border bg-muted px-3.5 py-3">
        <h3 className="text-table-head text-muted-foreground">Why it was blocked</h3>
        {!details ? (
          <p className="text-caption flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : details.failed ? (
          <p className="text-caption">Couldn’t load the details. You can still unblock it.</p>
        ) : (
          <dl className="flex flex-col gap-1.5">
            <Row label="Blocked by">
              {details.automatic ? 'Automatically' : (details.by ?? 'A Super Admin')} · {formatDate(details.created_at, 'MMM d')}
              {details.until ? `, until ${formatDate(details.until, 'MMM d')}` : ', until unblocked'}
            </Row>
            <Row label="Before the block">
              {details.before.failed} failed · {plural(details.before.accounts, 'account', 'accounts')} · {details.before.successful}{' '}
              successful
            </Row>
            <p className="text-caption">Reason given: “{details.reason}”</p>
          </dl>
        )}
      </section>

      {details?.refused_since > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-[10px] bg-warning-soft px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-caption text-foreground">
            <span className="text-badge block text-warning">Still trying while blocked</span>
            {plural(details.refused_since, 'more sign-in attempt was', 'more sign-in attempts were')} refused since the block
            {details.last_refused_at && `, the last one ${formatTimeAgo(details.last_refused_at)}`}. Unblocking now lets them try again.
          </p>
        </div>
      )}

      <CheckBoxRow
        checked={watch}
        onChange={setWatch}
        title="Watch it for 24 hours"
        caption="Block it again automatically after 3 failed sign-ins, and tell me."
      />
      <p className="text-caption">Recorded in the audit log.</p>
    </ConfirmDialog>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className="text-body-strong text-right text-foreground">{children}</dd>
    </div>
  )
}

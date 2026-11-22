import { useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { Ban, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { blockIp, getIpActivity } from '../api'
import { looksLikeIp } from '../utils'
import CheckBox from './CheckBox'

const DURATIONS = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: 'forever', label: 'Until I unblock it' },
]

/**
 * "Block 180.190.77.4?" (AL8, frame jx8DjvvgZ, 540px, red): the evidence from today (failed
 * sign-ins, accounts tried, successful sign-ins), how long, a required reason, and "Email … that
 * someone tried their accounts". A warning appears when real users signed in from this address.
 *
 * Without `ip` it's System health's "Block an IP address" (SH8, frame TMl_TrDqz): you type the
 * address, its evidence appears once it's a valid address, and the block starts short (24 hours).
 *   onDone(message)
 */
export default function BlockIpDialog({ ip: givenIp, onCancel, onDone }) {
  const typing = !givenIp
  const [typed, setTyped] = useState('')
  const debouncedTyped = useDebounce(typed.trim(), 400)
  const ip = givenIp ?? (looksLikeIp(debouncedTyped) ? debouncedTyped : null)

  const [loaded, setLoaded] = useState(null) // the activity of ONE address: { ip, … }
  const activity = loaded && loaded.forIp === ip ? loaded : null
  const [duration, setDuration] = useState(typing ? '24h' : '7d')
  const [reason, setReason] = useState(typing ? '' : 'Repeated failed sign-ins on admin accounts from an unknown address.')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!ip) return undefined
    let alive = true
    getIpActivity(ip)
      .then((a) => alive && setLoaded({ ...a, forIp: ip }))
      .catch(() => alive && setLoaded({ failed: true, forIp: ip }))
    return () => {
      alive = false
    }
  }, [ip])

  const realAccounts = activity?.accounts_tried?.filter((a) => a.exists) ?? []
  const usedByPeople = activity?.users_seen_30d ?? []

  const confirm = async () => {
    if (typing && !looksLikeIp(typed.trim())) return setFieldErrors({ ip: 'Type an IP address like 103.44.12.9.' })
    if (reason.trim().length < 5)
      return setFieldErrors({
        reason: 'Say why you are blocking this address (at least 5 characters).',
      })
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      const { block, accountsEmailed } = await blockIp({
        ip: givenIp ?? typed.trim(),
        duration,
        reason: reason.trim(),
        notifyAccounts: notify && realAccounts.length > 0,
      })
      const until = DURATIONS.find((d) => d.key === duration).label.toLowerCase()
      onDone(
        `${block.ip_address} is blocked ${duration === 'forever' ? 'until you unblock it' : `for ${until}`}.` +
          (accountsEmailed ? ` ${plural(accountsEmailed, 'person was', 'people were')} emailed.` : ''),
      )
    } catch (err) {
      setBusy(false)
      if (err.errors?.reason || err.errors?.ip_address)
        return setFieldErrors({
          reason: err.errors.reason?.[0],
          ip: err.errors.ip_address?.[0],
        })
      setError(err)
    }
  }

  return (
    <ConfirmDialog
      title={typing ? 'Block an IP address' : `Block ${ip}?`}
      description={
        typing
          ? 'Sign-in attempts from this address will be refused. Use it for an address that keeps trying to get into accounts.'
          : 'Sign-in attempts from this address will be refused for every company.'
      }
      icon={{ icon: Ban, tone: 'danger' }}
      tone="danger"
      confirmLabel={
        <>
          <Ban className="size-4" aria-hidden="true" /> Block{' '}
          {duration === 'forever' ? 'it' : `for ${DURATIONS.find((d) => d.key === duration).label}`}
        </>
      }
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      width={540}
    >
      {typing && (
        <FieldShell id="block-ip" label="IP address" required error={fieldErrors.ip} hint="One address, like 103.44.12.9.">
          <input
            id="block-ip"
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={Boolean(fieldErrors.ip) || undefined}
            placeholder="103.44.12.9"
            className={inputClass}
          />
        </FieldShell>
      )}

      {ip && (
        <section className="flex flex-col gap-1.5 rounded-[10px] border bg-muted px-3.5 py-3">
          <h3 className="text-table-head text-muted-foreground">Today from this address</h3>
          {!activity ? (
            <p className="text-caption flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Checking what it did…
            </p>
          ) : activity.failed ? (
            <p className="text-caption">Couldn’t load the activity. You can still block it.</p>
          ) : (
            <dl className="flex flex-col gap-1.5">
              <Row label="Failed sign-ins">
                <span className="text-badge rounded-full bg-danger-soft px-2 py-0.5 text-danger">{activity.failed_sign_ins}</span>
              </Row>
              <Row label="Accounts tried">
                <span className="text-body-strong text-right text-foreground">
                  {activity.accounts_tried.length === 0
                    ? 'None'
                    : activity.accounts_tried.map((a) => `${a.email}${a.exists ? '' : ' (no such account)'}`).join(', ')}
                </span>
              </Row>
              <Row label="Successful sign-ins">
                <span
                  className={cn(
                    'text-badge rounded-full px-2 py-0.5',
                    activity.successful_sign_ins ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
                  )}
                >
                  {activity.successful_sign_ins}
                </span>
              </Row>
            </dl>
          )}
        </section>
      )}

      {usedByPeople.length > 0 && (
        <p role="alert" className="text-caption rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-foreground">
          <span className="text-badge text-warning">Careful: </span>
          {usedByPeople.map((u) => u.full_name).join(', ')} signed in from this address in the last 30 days. Blocking it locks them out too
          (for example a shared office network).
        </p>
      )}

      <fieldset>
        <legend className="text-label mb-1.5 text-foreground">Block for</legend>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => {
            const on = duration === d.key
            return (
              <label
                key={d.key}
                className={cn(
                  'flex h-10 cursor-pointer items-center justify-center rounded-lg border px-2 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                  on ? 'text-badge border-danger bg-danger-soft text-danger' : 'text-caption bg-card hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="block-duration"
                  value={d.key}
                  checked={on}
                  onChange={() => setDuration(d.key)}
                  className="sr-only"
                />
                {d.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <FieldShell id="block-reason" label="Reason" required error={fieldErrors.reason}>
        <textarea
          id="block-reason"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={Boolean(fieldErrors.reason) || undefined}
          className={cn(inputClass, 'h-auto min-h-[60px] resize-y py-2')}
        />
      </FieldShell>

      {realAccounts.length > 0 && (
        <CheckBox checked={notify} onChange={setNotify}>
          <span className="text-body text-foreground">
            Email {realAccounts.map((a) => a.name ?? a.email).join(' and ')} that someone tried their{' '}
            {realAccounts.length === 1 ? 'account' : 'accounts'}
          </span>
        </CheckBox>
      )}

      <p className="text-caption">
        You can unblock it any time: search the address here and press Unblock. This is recorded in the audit log.
      </p>
    </ConfirmDialog>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-body text-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

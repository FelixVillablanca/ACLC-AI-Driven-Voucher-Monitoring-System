import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { getSupervisorAuditEntry } from '../api'
import { level2Path } from '../utils'

const MONEY_FIELD = /amount|budget|total|price|spend/i

/** "2500000.00" in a money field → "₱2,500,000.00"; anything else as it is. */
function value(field, v) {
  if (v == null) return null
  return MONEY_FIELD.test(field) && /^-?\d+(\.\d+)?$/.test(v) ? formatMoney(v) : v
}

/**
 * One audit entry (Framer cm5eFM0vJ "Audit entry #48,912"), 2026-11-27: action, who (+ role), record, when (to the
 * second), IP, the changes as FIELD / OLD / NEW, a note for sensitive changes, the tamper check, and "Open …" to the
 * voucher or the budgets page. Loading / error (404 = not in this company's trail) inside the panel.
 * Code differs from the frame: no "Export entry" (Export log on the page exports what's filtered); the tamper check is shown.
 */
export default function AuditEntryDrawer({ id, onClose }) {
  const [state, setState] = useState({ id: null, status: 'loading', entry: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${attempt}`

  useEffect(() => {
    let alive = true
    getSupervisorAuditEntry(id)
      .then((entry) => alive && setState({ id: key, status: 'success', entry, error: null }))
      .catch((error) => alive && setState({ id: key, status: 'error', entry: null, error }))
    return () => {
      alive = false
    }
  }, [key, id])

  const status = state.id === key ? state.status : 'loading'
  const e = status === 'success' ? state.entry : null
  const open = e?.link
    ? e.link.kind === 'voucher'
      ? { to: level2Path(e.link.id), label: 'Open voucher' }
      : { to: PATHS.SUPERVISOR_BUDGETS, label: 'Open budgets' }
    : null

  return (
    <SidePanel
      label={`Audit entry #${id}`}
      width={460}
      onClose={onClose}
      footer={
        open ? (
          <Link
            to={open.to}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {open.label} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
        <h2 className="text-card-title">Audit entry #{Number(id).toLocaleString('en-US')}</h2>
        <PanelClose onClick={onClose} />
      </div>

      {status === 'loading' && (
        <div role="status" aria-label="Loading the entry" className="flex flex-col gap-3 px-6 py-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-muted" />
          ))}
          <div className="h-[120px] animate-pulse rounded-lg bg-muted" />
        </div>
      )}
      {status === 'error' && (
        <ErrorState
          title={state.error.status === 404 ? 'Entry not found' : "Couldn't load this entry"}
          message={state.error.status === 404 ? 'It isn’t part of this company’s audit trail.' : state.error.message}
          requestId={state.error.status === 404 ? undefined : state.error.requestId}
          onRetry={state.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
        />
      )}

      {e && (
        <div className="flex flex-col gap-5 px-6 py-5">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5">
            <dt className="text-caption">Action</dt>
            <dd>
              <Pill tone={e.action.tone}>{e.action.label}</Pill>
            </dd>
            <dt className="text-caption">User</dt>
            <dd className="text-body-strong">
              {e.who.name}
              {e.who.role && <span className="text-caption font-normal"> · {e.who.role}</span>}
              {e.who.is_you && <span className="text-caption font-normal"> (you)</span>}
            </dd>
            <dt className="text-caption">Record</dt>
            <dd className="text-body">
              {e.record.title}
              <span className="text-caption block">
                {e.table}
                {e.record_id ? ` #${e.record_id}` : ''}
              </span>
            </dd>
            <dt className="text-caption">When</dt>
            <dd className="text-body tabular-nums">{formatDate(e.at, 'MMM d, yyyy · HH:mm:ss')}</dd>
            <dt className="text-caption">IP address</dt>
            <dd className="text-body tabular-nums">{e.ip ?? '—'}</dd>
            {e.browser && (
              <>
                <dt className="text-caption">Browser</dt>
                <dd className="text-body">{e.browser}</dd>
              </>
            )}
          </dl>

          <section className="flex flex-col gap-2" aria-label="Changes">
            <h3 className="text-table-head text-muted-foreground">Changes</h3>
            {e.changes.length === 0 ? (
              <p className="text-caption">No field values were recorded for this event.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left">
                  <thead className="border-b bg-muted">
                    <tr className="text-table-head text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Field</th>
                      <th className="px-3 py-2 font-semibold">Old</th>
                      <th className="px-3 py-2 font-semibold">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.changes.map((c) => (
                      <tr key={c.field} className="border-b align-top last:border-b-0">
                        <td className="text-caption px-3 py-2 break-all">{c.field}</td>
                        <td className="text-body px-3 py-2 break-words text-danger tabular-nums">{value(c.field, c.old) ?? '—'}</td>
                        <td className="text-body px-3 py-2 break-words text-success tabular-nums">{value(c.field, c.new) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {e.action.sensitive && (
            <p className="text-body flex gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>Sensitive change{e.note ? `: ${e.note}` : '. It changes money limits or who can do what.'}</span>
            </p>
          )}

          <p className="text-caption flex items-center gap-1.5">
            {e.integrity === 'changed' ? (
              <>
                <ShieldAlert className="size-4 text-danger" aria-hidden="true" />
                <span className="text-danger">This entry doesn’t match its fingerprint: it may have been changed in the database.</span>
              </>
            ) : e.integrity === 'intact' ? (
              <>
                <ShieldCheck className="size-4 text-success" aria-hidden="true" /> Untouched since it was written.
              </>
            ) : (
              'Written before fingerprints were added, so it can’t be checked.'
            )}
            {e.request_id && <span className="ml-auto">Request {e.request_id}</span>}
          </p>
        </div>
      )}
    </SidePanel>
  )
}

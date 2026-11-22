import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { PATHS } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getIncident, resolveIncident } from '../api'
import { serviceLabel } from '../utils'

const STATUS = {
  open: { tone: 'danger', text: '● Open' },
  watching: { tone: 'warning', text: '● Watching' },
  resolved: { tone: 'success', text: '✓ Resolved' },
}

/**
 * SH10 Incident details side panel (frame d3u7JybYW): what was affected, the timeline (from the
 * automatic checks), and "✓ Mark resolved" with a required closing note.
 *   onResolved(message)
 */
export default function IncidentPanel({ id, onClose, onResolved }) {
  const [state, setState] = useState({
    status: 'loading',
    incident: null,
    error: null,
  })
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const fetchIncident = useCallback(
    () =>
      getIncident(id)
        .then((incident) => setState({ status: 'success', incident, error: null }))
        .catch((err) => setState({ status: 'error', incident: null, error: err })),
    [id],
  )
  useEffect(() => {
    fetchIncident()
  }, [fetchIncident])

  const resolve = async () => {
    if (note.trim().length < 5) return setNoteError('Write what fixed it (at least 5 characters).')
    setBusy(true)
    setError(null)
    setNoteError(null)
    try {
      const incident = await resolveIncident(id, note.trim())
      setState({ status: 'success', incident, error: null })
      onResolved(`${incident.code} is marked resolved.`)
    } catch (err) {
      if (err.errors?.note) setNoteError(err.errors.note[0])
      else setError(err)
      if (err.status === 409) fetchIncident()
    } finally {
      setBusy(false)
    }
  }

  const i = state.incident
  const open = i && i.status !== 'resolved'

  return (
    <SidePanel
      label="Incident details"
      onClose={onClose}
      footer={
        i && (
          <>
            <Link
              to={`${PATHS.SUPERADMIN_AUDIT_LOGS}?action=incident_resolved&from=${i.started_at.slice(0, 10)}`}
              className="text-auth-link mr-auto rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              View in audit logs →
            </Link>
            {open && (
              <button
                type="button"
                onClick={resolve}
                disabled={busy}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                Mark resolved
              </button>
            )}
          </>
        )
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="text-caption flex flex-1 items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading the incident…
        </p>
      )}
      {state.status === 'error' && (
        <div className="flex flex-col">
          <div className="flex justify-end p-3">
            <PanelClose onClick={onClose} />
          </div>
          <ErrorState
            title="Couldn't load this incident"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={fetchIncident}
          />
        </div>
      )}

      {i && (
        <>
          <header className="flex items-start gap-3 border-b px-6 pt-6 pb-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-page-title">{i.title}</h2>
                <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].text}</Pill>
              </div>
              <p className="text-caption">
                Incident {i.code} · started {formatDate(i.started_at, 'MMM d, h:mm a')} · affects {serviceLabel(i.service)} only
              </p>
            </div>
            <PanelClose onClick={onClose} />
          </header>

          <div className="flex flex-col gap-5 px-6 py-5">
            <div className={cn('flex flex-col gap-1 rounded-[10px] px-3.5 py-3', i.status === 'resolved' ? 'bg-success-soft' : 'bg-muted')}>
              <p className="text-body-strong">Impact</p>
              <p className="text-caption">
                {serviceLabel(i.service)} was {i.severity === 'danger' ? 'not working' : 'slow'} for about {i.minutes} minutes
                {i.recovered_at ? `, until ${formatDate(i.recovered_at, 'h:mm a')}` : ' so far'}. Other services kept working.
              </p>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-table-head text-muted-foreground">What happened</h3>
              <ol className="flex flex-col gap-2 border-l-2 pl-4">
                {i.timeline.map((t, n) => (
                  <li key={n} className="relative flex gap-3">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" aria-hidden="true" />
                    <time className="text-caption w-16 shrink-0" dateTime={t.at}>
                      {formatDate(t.at, 'h:mm a')}
                    </time>
                    <span className="text-body">{t.text}</span>
                  </li>
                ))}
              </ol>
            </section>

            {i.status === 'resolved' ? (
              <section className="flex flex-col gap-1">
                <h3 className="text-table-head text-muted-foreground">Closing note</h3>
                <p className="text-body">“{i.closing_note}”</p>
                <p className="text-caption">
                  {i.resolved_by ? `By ${i.resolved_by}` : ''} · {formatDate(i.resolved_at, 'MMM d, h:mm a')}
                </p>
              </section>
            ) : (
              <>
                {i.status === 'open' && (
                  <p className="text-caption rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-foreground">
                    It’s still unhealthy. You can resolve it now, but it opens again by itself if the checks keep failing.
                  </p>
                )}
                <FieldShell
                  id="incident-note"
                  label="Closing note"
                  required
                  error={noteError}
                  hint="Needed to mark it resolved. It stays in the incident history."
                >
                  <textarea
                    id="incident-note"
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    aria-invalid={Boolean(noteError) || undefined}
                    placeholder="What fixed it, and anything to do differently next time"
                    className={cn(inputClass, 'h-auto min-h-[72px] resize-y py-2')}
                  />
                </FieldShell>
                {error && (
                  <p role="alert" className="text-caption text-danger">
                    {error.message}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </SidePanel>
  )
}

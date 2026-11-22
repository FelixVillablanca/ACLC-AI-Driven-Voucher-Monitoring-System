import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { RETRY_JOBS_SEARCH } from '@/features/superadmin/jobs'
import { formatDate, formatNumber, plural } from '@/lib/formatters'
import { getJobsPanel } from '../api'
import { formatMs, statusPill } from '../utils'

/**
 * SH4 "Background jobs" side panel (frame y5H_QPGwO): why it's marked slow, Waiting / Running /
 * Done today tiles, a 24-hour bar chart of jobs waiting (from the saved checks), what is already
 * being handled, and what you can do (Retry failed → SH6).
 */
export default function JobsPanel({ onClose }) {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  })

  const fetchPanel = useCallback(
    () =>
      getJobsPanel()
        .then((data) => setState({ status: 'success', data, error: null }))
        .catch((error) => setState({ status: 'error', data: null, error })),
    [],
  )
  useEffect(() => {
    fetchPanel() // starts at 'loading': the panel mounts fresh each time it opens
  }, [fetchPanel])

  const d = state.data
  const q = d?.queue
  const retryable = d?.failed.jobs.filter((j) => j.retryable) ?? []

  return (
    <SidePanel
      label="Background jobs"
      onClose={onClose}
      footer={
        d && (
          <>
            {retryable.length > 0 && (
              <Link
                to={{ search: RETRY_JOBS_SEARCH }}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Retry failed ({retryable.length})
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Close
            </button>
          </>
        )
      }
    >
      <header className="flex items-start gap-3 border-b px-6 pt-6 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-page-title">Background jobs</h2>
            {q && <Pill tone={statusPill('queue', q.status).tone}>{statusPill('queue', q.status).text}</Pill>}
          </div>
          <p className="text-caption">Does the slow work behind the scenes: AI checks, report summaries, exports and emails.</p>
        </div>
        <PanelClose onClick={onClose} />
      </header>

      <div className="flex flex-col gap-5 px-6 py-5">
        {state.status === 'loading' && (
          <p role="status" className="text-caption flex items-center justify-center gap-2 py-10">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading the jobs…
          </p>
        )}
        {state.status === 'error' && (
          <ErrorState title="Couldn't load the jobs" message={state.error.message} requestId={state.error.requestId} onRetry={fetchPanel} />
        )}

        {d && (
          <>
            {q.status !== 'ok' && (
              <div className="flex flex-col gap-1 rounded-[10px] bg-warning-soft px-3.5 py-3">
                <p className="text-badge text-warning">Why it needs a look</p>
                <p className="text-body">
                  {[
                    q.waiting >= 10 && `${q.waiting} jobs are waiting (usually fewer than 5)`,
                    q.failed_last_hour > 0 && `${plural(q.failed_last_hour, 'job', 'jobs')} failed in the last hour`,
                    q.failed > 0 &&
                      q.failed_last_hour === 0 &&
                      `${plural(q.failed, 'failed job is', 'failed jobs are')} waiting for you to retry or dismiss`,
                  ]
                    .filter(Boolean)
                    .join(', and ')}
                  .
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Tile label="Waiting" value={formatNumber(q.waiting)} note="normal: under 5" />
              <Tile label="Running now" value={formatNumber(q.running)} />
              <Tile
                label="Done today"
                value={formatNumber(q.done_today)}
                note={q.avg_ms != null ? `avg ${formatMs(q.avg_ms)} each` : 'counted by the worker'}
              />
            </div>

            <QueueChart hours={d.hours} />

            <section className="flex flex-col gap-1.5">
              <h3 className="text-table-head text-muted-foreground">Already being handled</h3>
              {d.retrying.length > 0 ? (
                <p className="text-body flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {plural(d.retrying.length, 'job is', 'jobs are')} retrying on their own.
                </p>
              ) : (
                <p className="text-caption">No job is waiting for another try.</p>
              )}
              <p className="text-body flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> Vouchers still submit. Their AI check
                just shows “pending” until it’s done.
              </p>
              {d.failed.total > 0 && (
                <p className="text-body flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  {plural(d.failed.total, 'job', 'jobs')} gave up and won’t try again by themselves.
                </p>
              )}
            </section>

            {d.failed.jobs.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-table-head text-muted-foreground">Gave up</h3>
                <ul className="flex flex-col">
                  {d.failed.jobs.slice(0, 8).map((j) => (
                    <li key={j.id} className="border-b py-2 last:border-b-0">
                      <p className="text-body-strong">{j.name}</p>
                      <p className="text-caption">
                        {formatDate(j.failed_at, 'MMM d, h:mm a')} · {j.error}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </SidePanel>
  )
}

function Tile({ label, value, note }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border px-3 py-2.5">
      <span className="text-caption">{label}</span>
      <span className="text-card-title">{value}</span>
      {note && <span className="text-caption">{note}</span>}
    </div>
  )
}

/** Jobs waiting, last 24 hours: one bar per hour (the highest count that hour). */
function QueueChart({ hours }) {
  const max = Math.max(1, ...hours.map((h) => h.waiting))
  return (
    <section className="flex flex-col gap-2 rounded-[10px] border px-3.5 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-body-strong">Jobs waiting, last 24 hours</h3>
        <span className="text-caption">peak {max === 1 && hours.every((h) => h.waiting === 0) ? 0 : max}</span>
      </div>
      {hours.length === 0 ? (
        <p className="text-caption">No checks recorded yet. They start once the scheduler runs (dev.ps1).</p>
      ) : (
        <>
          <div className="flex h-20 items-end gap-[3px]" role="img" aria-label={`Highest per hour, peak ${max}`}>
            {hours.map((h) => (
              <div
                key={h.hour}
                title={`${formatDate(h.hour, 'MMM d, h a')}: ${h.waiting} waiting`}
                style={{ height: `${Math.max(4, (h.waiting / max) * 100)}%` }}
                className={h.waiting >= 10 ? 'flex-1 rounded-t-sm bg-warning' : 'flex-1 rounded-t-sm bg-primary/70'}
              />
            ))}
          </div>
          <div className="text-caption flex justify-between">
            <span>{formatDate(hours[0].hour, 'MMM d, h a')}</span>
            <span>Now</span>
          </div>
        </>
      )}
    </section>
  )
}

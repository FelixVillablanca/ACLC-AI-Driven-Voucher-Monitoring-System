import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { formatDate } from '@/lib/formatters'
import { dismissJob, getFailedJob, retryJob } from '../api'

/**
 * SH5 Job details side panel (frame pZGUgQsG5): what the job was, when it gave up, the error
 * (server folders removed), and "↻ Retry this job" / "Dismiss". Laravel doesn't keep each try,
 * so there's one "gave up" entry instead of a timeline of tries.
 *   onChanged(message) after retry / dismiss
 */
export default function JobDetailPanel({ uuid, onClose, onChanged }) {
  const [state, setState] = useState({
    status: 'loading',
    job: null,
    error: null,
  })
  const [busy, setBusy] = useState(null) // 'retry' | 'dismiss'

  const fetchJob = useCallback(
    () =>
      getFailedJob(uuid)
        .then((job) => setState({ status: 'success', job, error: null }))
        .catch((error) => setState({ status: 'error', job: null, error })),
    [uuid],
  )
  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const act = async (kind) => {
    setBusy(kind)
    try {
      if (kind === 'retry') await retryJob(uuid)
      else await dismissJob(uuid)
      onChanged(
        kind === 'retry'
          ? `${state.job.name} is back in the queue. It runs again in a moment.`
          : `${state.job.name} was dismissed. It won’t run again.`,
      )
    } catch (err) {
      toast.error(err.message)
      setBusy(null)
    }
  }

  const j = state.job

  return (
    <SidePanel
      label="Job details"
      onClose={onClose}
      footer={
        j && (
          <>
            <button
              type="button"
              onClick={() => act('dismiss')}
              disabled={busy !== null}
              className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
            </button>
            {j.retryable && (
              <button
                type="button"
                onClick={() => act('retry')}
                disabled={busy !== null}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {busy === 'retry' ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="size-4" aria-hidden="true" />
                )}
                Retry this job
              </button>
            )}
          </>
        )
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="text-caption flex flex-1 items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading the job…
        </p>
      )}
      {state.status === 'error' && (
        <div className="flex flex-col">
          <div className="flex justify-end p-3">
            <PanelClose onClick={onClose} />
          </div>
          <ErrorState
            title={state.error.status === 404 ? 'This job isn’t failed any more' : "Couldn't load this job"}
            message={state.error.status === 404 ? 'Someone retried or dismissed it meanwhile.' : state.error.message}
            requestId={state.error.requestId}
            onRetry={state.error.status === 404 ? undefined : fetchJob}
          />
        </div>
      )}

      {j && (
        <>
          <header className="flex items-start gap-3 border-b px-6 pt-6 pb-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-card-title text-base">{j.name}</h2>
                <Pill tone="danger">Failed</Pill>
              </div>
              <p className="text-caption">{[j.subject, `queue “${j.queue}”`, j.class].filter(Boolean).join(' · ')}</p>
            </div>
            <PanelClose onClick={onClose} />
          </header>
          <div className="flex flex-col gap-5 px-6 py-5">
            <section className="flex flex-col gap-1.5">
              <h3 className="text-table-head text-muted-foreground">What happened</h3>
              <p className="text-body-strong">
                Gave up {formatDate(j.failed_at, 'MMM d, h:mm a')}
                {j.max_tries ? ` after ${j.max_tries} ${j.max_tries === 1 ? 'try' : 'tries'}` : ''}
              </p>
              <p className="text-caption">{j.error}</p>
              {!j.retryable && j.note && <p className="text-caption text-warning">{j.note}</p>}
            </section>
            {j.error_lines?.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-table-head text-muted-foreground">Error details</h3>
                <pre className="text-caption overflow-x-auto rounded-[10px] bg-muted px-3.5 py-3 whitespace-pre-wrap">
                  {j.error_lines.join('\n')}
                </pre>
              </section>
            )}
            <dl className="flex flex-col gap-1.5 rounded-[10px] border px-3.5 py-3">
              <Fact label="Job ID">{j.id}</Fact>
              <Fact label="Connection">{j.connection}</Fact>
              {j.timeout && <Fact label="Time limit">{j.timeout} s</Fact>}
            </dl>
          </div>
        </>
      )}
    </SidePanel>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right break-all">{children}</dd>
    </div>
  )
}

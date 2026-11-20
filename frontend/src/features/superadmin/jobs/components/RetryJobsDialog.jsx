import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CircleCheck, Loader2, RotateCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deleteFailedJobs, retryFailedJobs } from '../api'
import { useFailedJobs } from '../hooks/useFailedJobs'
import { announceJobsChanged, RETRY_JOBS_PARAM, RETRY_JOBS_VALUE, serviceStatus } from '../utils'
import FailedJobRow from './FailedJobRow'

/**
 * "Retry failed jobs" (Framer fzdOvPqCX, 560px), from the dashboard's "N background jobs failed" row.
 * Opens on ANY Super Admin page when the address has ?retry=jobs.
 */
export default function RetryJobsDialog() {
  const [params, setParams] = useSearchParams()
  const open = params.get(RETRY_JOBS_PARAM) === RETRY_JOBS_VALUE

  const close = useCallback(() => {
    setParams(
      (p) => {
        p.delete(RETRY_JOBS_PARAM)
        return p
      },
      { replace: true },
    )
  }, [setParams])

  return <AnimatePresence>{open && <Window key="retry-jobs" onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const list = useFailedJobs()
  // Rows the person UNticked / ticked by hand. Everything else follows the default:
  // retryable jobs start ticked (as in the frame), the others start unticked.
  const [overrides, setOverrides] = useState({})
  const [busy, setBusy] = useState(null) // 'retry' | 'delete'
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !confirmDelete && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, confirmDelete])

  const isChecked = (job) => overrides[job.id] ?? job.retryable
  const selected = list.jobs.filter(isChecked)
  const toRetry = selected.filter((job) => job.retryable)

  const afterChange = () => {
    setOverrides({})
    announceJobsChanged()
    return list.reload({ quiet: true })
  }

  const retry = async () => {
    setBusy('retry')
    setError(null)
    try {
      const count = await retryFailedJobs(toRetry.map((job) => job.id))
      toast.success(`${plural(count, 'job was', 'jobs were')} put back in the queue`)
      await afterChange()
    } catch (err) {
      setError(err)
      if (err.code === 'JOB_NOT_FOUND') list.reload({ quiet: true }) // someone else already handled some
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      const count = await deleteFailedJobs(selected.map((job) => job.id))
      setConfirmDelete(false)
      toast.success(`${plural(count, 'job was', 'jobs were')} deleted`)
      await afterChange()
    } catch (err) {
      setConfirmDelete(false)
      setError(err)
      if (err.code === 'JOB_NOT_FOUND') list.reload({ quiet: true })
    } finally {
      setBusy(null)
    }
  }

  const services = Object.entries(list.services ?? {}).map(([key, status]) => serviceStatus(key, status))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-[150px]"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="retry-jobs-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex max-h-[calc(100dvh-2rem)] w-[560px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl sm:max-h-[calc(100dvh-10rem)]"
      >
        <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="retry-jobs-title" className="text-page-title">
              Retry failed jobs
            </h2>
            <p className="text-body text-muted-foreground">
              These background jobs gave up after their last try. Retrying puts them back in the queue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-6 py-[18px]">
          {list.status === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <span className="text-caption">Loading failed jobs…</span>
            </div>
          )}

          {list.status === 'error' && (
            <ErrorState
              title="Couldn't load the failed jobs"
              message={list.error.message}
              requestId={list.error.requestId}
              onRetry={() => list.reload()}
            />
          )}

          {list.status === 'success' && list.jobs.length === 0 && (
            <EmptyState
              icon={CircleCheck}
              title="No failed jobs"
              description="Every background job finished. There’s nothing to retry."
            />
          )}

          {list.status === 'success' &&
            list.jobs.map((job) => (
              <FailedJobRow
                key={job.id}
                job={job}
                checked={isChecked(job)}
                onToggle={() => setOverrides((prev) => ({ ...prev, [job.id]: !isChecked(job) }))}
              />
            ))}

          {list.status === 'success' && list.total > list.jobs.length && (
            <p className="text-caption">
              Showing the newest {list.jobs.length} of {list.total}. Retry or delete these to see the rest.
            </p>
          )}

          {list.status === 'success' &&
            list.jobs.length > 0 &&
            services.map((s) => (
              <div
                key={s.title}
                className={cn('flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5', s.tone === 'danger' ? 'bg-danger-soft' : 'bg-warning-soft')}
              >
                <p className={cn('text-badge', s.tone === 'danger' ? 'text-danger' : 'text-warning')}>{s.title}</p>
                <p className="text-caption">{s.caption}</p>
              </div>
            ))}

          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-body-strong text-danger">{error.message}</p>
                {error.requestId && <p className="text-caption">Reference: {error.requestId}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
          {list.jobs.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={selected.length === 0 || busy !== null}
              className="text-body-strong mr-auto rounded text-danger outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline"
            >
              Delete selected jobs
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {list.jobs.length === 0 ? 'Close' : 'Cancel'}
          </button>
          {list.jobs.length > 0 && (
            <button
              type="button"
              onClick={retry}
              disabled={toRetry.length === 0 || busy !== null}
              className="text-auth-button flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'retry' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw className="size-4" aria-hidden="true" />
              )}
              Retry {plural(toRetry.length, 'job', 'jobs')}
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            title={`Delete ${plural(selected.length, 'job', 'jobs')}?`}
            confirmLabel="Delete for good"
            tone="danger"
            busy={busy === 'delete'}
            onConfirm={remove}
            onCancel={() => setConfirmDelete(false)}
          >
            <p>
              {selected.length === 1 ? 'It' : 'They'} will never run. Anything they were meant to do (for example an AI check)
              won’t happen unless it’s started again some other way. This can’t be undone.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

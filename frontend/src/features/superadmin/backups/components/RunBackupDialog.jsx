import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, DatabaseBackup, Loader2 } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/utils'
import { startBackup } from '../api'
import { useBackupOverview } from '../hooks/useBackupOverview'
import {
  announceBackupsChanged,
  backupReason,
  destinationText,
  formatBytes,
  formatEstimate,
  formatLastBackup,
  RUN_BACKUP_PARAM,
  RUN_BACKUP_VALUE,
} from '../utils'
import BackupProgressView from './BackupProgressView'
import DialogFooter from './DialogFooter'
import SecondaryButton from './SecondaryButton'

/**
 * "Run a database backup now?" (Framer TKziMjHUe, 460px), opened from the dashboard's
 * "Needs your attention" row. Opens on ANY Super Admin page when the address has ?run=backup.
 *
 * After "Run backup now" the same window follows the backup (running → finished / failed).
 * If a backup is already running when it opens, it goes straight to that view.
 */
export default function RunBackupDialog() {
  const [params, setParams] = useSearchParams()
  const open = params.get(RUN_BACKUP_PARAM) === RUN_BACKUP_VALUE

  const close = useCallback(() => {
    setParams(
      (p) => {
        p.delete(RUN_BACKUP_PARAM)
        return p
      },
      { replace: true },
    )
  }, [setParams])

  return <AnimatePresence>{open && <Window key="run-backup" onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const overview = useBackupOverview()
  const [started, setStarted] = useState(null) // the backup this window started

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Following a backup: the one we just started, or one that was already running
  const active = started ?? overview.overview?.current ?? null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-[200px]"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-backup-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex w-[460px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl"
      >
        {overview.status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 p-12">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Checking the last backup…</span>
          </div>
        )}

        {overview.status === 'error' && (
          <>
            <h2 id="run-backup-title" className="sr-only">
              Run a database backup
            </h2>
            <ErrorState
              title="Couldn't check the backups"
              message={overview.error.message}
              requestId={overview.error.requestId}
              onRetry={overview.reload}
            />
            <DialogFooter>
              <SecondaryButton onClick={onClose}>Close</SecondaryButton>
            </DialogFooter>
          </>
        )}

        {overview.status === 'success' && active && (
          <BackupProgressView
            key={active.id}
            initial={active}
            estimatedSeconds={overview.overview.estimated_seconds}
            onClose={onClose}
            onRunAgain={() => {
              setStarted(null)
              overview.reload()
            }}
          />
        )}

        {overview.status === 'success' && !active && (
          <ConfirmView
            overview={overview.overview}
            onStarted={(backup) => {
              announceBackupsChanged()
              setStarted(backup)
            }}
            onAlreadyRunning={overview.reload}
            onClose={onClose}
          />
        )}
      </motion.div>
    </motion.div>
  )
}

function ConfirmView({ overview, onStarted, onAlreadyRunning, onClose }) {
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      onStarted(await startBackup({ notify }))
    } catch (err) {
      setBusy(false)
      if (err.code === 'BACKUP_IN_PROGRESS') onAlreadyRunning() // someone else just started one: follow it
      else setError(err)
    }
  }

  const facts = [
    ['Last good backup', formatLastBackup(overview.last_success?.finished_at)],
    ['Database size', formatBytes(overview.database_size_bytes)],
    ['Estimated time', formatEstimate(overview.estimated_seconds)],
    ['Saved to', destinationText(overview.destination)],
  ]

  return (
    <>
      <div className="flex flex-col gap-3.5 px-6 pt-6 pb-5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <DatabaseBackup className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 id="run-backup-title" className="text-page-title">
            Run a database backup now?
          </h2>
          <p className="text-body text-muted-foreground">{backupReason(overview)}</p>
        </div>

        <dl className="flex flex-col gap-2 rounded-[10px] bg-muted px-3.5 py-3">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2.5">
              <dt className="text-caption">{label}</dt>
              <dd className="text-body-strong text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-caption">
          Backups also run by themselves every night at {overview.nightly_at}. The newest {overview.keep} are kept.
        </p>

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

      <DialogFooter>
        <label className="text-caption mr-auto flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden="true"
            className={cn(
              'flex size-4 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
              notify ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
            )}
          >
            {notify && <Check className="size-3" strokeWidth={3} />}
          </span>
          Notify me when it finishes
        </label>
        <SecondaryButton onClick={onClose} disabled={busy}>
          Cancel
        </SecondaryButton>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="text-auth-button flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Run backup now
        </button>
      </DialogFooter>
    </>
  )
}


import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { CircleCheck, CircleX, DatabaseBackup, Loader2, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useBackupProgress } from '../hooks/useBackupProgress'
import { announceBackupsChanged, formatBytes, formatDuration, formatEstimate } from '../utils'
import DialogFooter from './DialogFooter'
import SecondaryButton from './SecondaryButton'

/** Waiting longer than this for the worker to pick the job up gets a gentle note. */
const SLOW_START_SECONDS = 60

/**
 * Follows one backup inside the dialog (not in the frame set; same look as TKziMjHUe):
 *   queued / running  → spinner + moving bar, "you can close this window"
 *   succeeded         → green tick, size + how long it took (+ a success toast)
 *   failed            → red cross, the reason, "Try again" (+ an error toast)
 */
export default function BackupProgressView({ initial, estimatedSeconds, onClose, onRunAgain }) {
  const { backup, finished, checkFailed, waitingSeconds } = useBackupProgress(initial)
  const announced = useRef(false)

  // Toast + refresh the dashboard ONCE, when it ends while this window is open
  useEffect(() => {
    if (!finished || announced.current) return
    announced.current = true
    announceBackupsChanged()
    if (backup.status === 'succeeded') toast.success(`Backup finished (${formatBytes(backup.size_bytes)})`)
    else toast.error('The backup did not finish')
  }, [finished, backup.status, backup.size_bytes])

  const look = {
    succeeded: { icon: CircleCheck, tile: 'bg-success-soft text-success', title: 'Backup finished' },
    failed: { icon: CircleX, tile: 'bg-danger-soft text-danger', title: 'The backup didn’t finish' },
  }[backup.status] ?? { icon: DatabaseBackup, tile: 'bg-primary-soft text-primary', title: 'Backing up the database…' }

  return (
    <>
      <div className="flex flex-col gap-3.5 px-6 pt-6 pb-5" aria-live="polite">
        <div className={cn('flex size-11 items-center justify-center rounded-xl', look.tile)}>
          <look.icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 id="run-backup-title" className="text-page-title">
            {look.title}
          </h2>
          {!finished && (
            <p className="text-body text-muted-foreground">
              {backup.status === 'queued' ? 'Waiting to start' : `Started ${format(new Date(backup.started_at), 'HH:mm')}`} ·{' '}
              {formatEstimate(estimatedSeconds).toLowerCase()}. You can close this window; the backup keeps going.
            </p>
          )}
          {backup.status === 'succeeded' && (
            <p className="text-body text-muted-foreground">The database was copied and saved. Users weren’t interrupted.</p>
          )}
          {backup.status === 'failed' && (
            <p className="text-body text-muted-foreground">Nothing was changed in the database. You can try again.</p>
          )}
        </div>

        {!finished && (
          <div className="h-1.5 overflow-hidden rounded-full bg-primary-soft" role="progressbar" aria-label="Backup in progress">
            <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        )}

        {backup.status === 'succeeded' && (
          <dl className="flex flex-col gap-2 rounded-[10px] bg-muted px-3.5 py-3">
            <Fact label="Finished">{format(new Date(backup.finished_at), 'MMM d, HH:mm')}</Fact>
            <Fact label="File size">{formatBytes(backup.size_bytes)}</Fact>
            <Fact label="Took">{formatDuration(backup.duration_seconds)}</Fact>
          </dl>
        )}

        {backup.status === 'failed' && backup.error && (
          <p className="text-caption rounded-[10px] border border-danger/20 bg-danger-soft px-3.5 py-3 break-words">
            Reason: {backup.error}
          </p>
        )}

        {waitingSeconds > SLOW_START_SECONDS && (
          <p className="text-caption rounded-[10px] border border-warning/20 bg-warning-soft px-3.5 py-3">
            The background worker hasn’t picked this up yet. If it doesn’t start in a few minutes, check that the queue worker is running.
          </p>
        )}

        {checkFailed && !finished && (
          <p className="text-caption flex items-center gap-1.5">
            <WifiOff className="size-3.5" aria-hidden="true" />
            Couldn’t check on the backup just now. Trying again…
          </p>
        )}

        {!finished && backup.requested_by && (
          <p className="text-caption flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Started by {backup.requested_by.full_name}
          </p>
        )}
      </div>

      <DialogFooter>
        {backup.status === 'failed' && (
          <button
            type="button"
            onClick={onRunAgain}
            className="text-auth-button mr-auto h-10 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Try again
          </button>
        )}
        <SecondaryButton onClick={onClose}>{finished ? 'Done' : 'Close'}</SecondaryButton>
      </DialogFooter>
    </>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body-strong text-right">{children}</dd>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { cn } from '@/lib/utils'
import { failedLine } from '../utils'

/**
 * One failed job (Framer fzdOvPqCX row): tick box, "name · subject", the error, when it failed,
 * and a red "Failed" pill. Ticked rows are tinted Primary Faint.
 * A job that can't be retried says why (it can still be ticked to delete it).
 */
export default function FailedJobRow({ job, checked, onToggle }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3 transition-colors',
        checked ? 'border-primary-soft bg-primary-faint' : 'bg-card hover:bg-muted',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-body-strong">
          {job.name}
          {job.subject && ` · ${job.subject}`}
        </span>
        <span className="text-caption break-words">Error: {job.error}</span>
        <span className="text-caption">{failedLine(job)}</span>
        {!job.retryable && (
          <span className="text-caption text-warning">
            Can’t be retried.{' '}
            {job.name === 'Database backup' ? (
              <Link to={{ search: '?run=backup' }} className="font-medium text-primary underline-offset-2 hover:underline">
                Run a new backup instead
              </Link>
            ) : (
              job.note
            )}
          </span>
        )}
      </span>

      <Pill tone="danger">Failed</Pill>
    </label>
  )
}

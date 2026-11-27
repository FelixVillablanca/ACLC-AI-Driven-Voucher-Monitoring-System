import { Check } from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { returnedByText } from '../utils'

/**
 * Top of Fix & resubmit (Framer EWrCKOIlI): who sent it back, as which reviewer, when, and their note.
 * The green chip appears once changes were saved after the return (`returned.edited_since`, or a save on
 * this visit). The amber tags are what the reviewer asked to change (`returned.needs_changes`).
 * Code differs from the frame: no per-part "✓ Line items fixed" chips (ADVMS can't tell a part is fixed).
 */
export default function ReturnedBanner({ returned, saved }) {
  const initials =
    (returned?.by ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'

  return (
    <div role="note" className="flex gap-3 rounded-xl border border-danger bg-danger-soft px-4 py-3.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white',
          returned?.step === 2 ? 'bg-primary-dark' : 'bg-primary',
        )}
      >
        {initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-body-strong text-danger">
          Returned by {returnedByText(returned)}
          {returned?.at && ` · ${formatDate(returned.at, 'MMM d, h:mm a')}`}
        </p>
        <p className={cn('text-body', !returned?.remarks && 'text-muted-foreground')}>
          {returned?.remarks ? `“${returned.remarks}”` : 'No note was left. Ask the reviewer what to change if it isn’t clear.'}
        </p>
        {returned?.needs_changes?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-caption">Needs changes:</span>
            {returned.needs_changes.map((t) => (
              <span key={t} className="text-badge rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                {t}
              </span>
            ))}
          </div>
        )}
        {saved && (
          <div className="flex pt-1">
            <span className="text-badge inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Changes saved since it came back
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

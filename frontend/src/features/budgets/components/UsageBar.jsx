import { cn } from '@/lib/utils'
import { TONE_BAR, usageTone } from '../utils'

/**
 * A budget usage bar: the used part in its tone, an optional "pending" part on top of it (Warning), and a
 * thin marker at the alert %. Values over 100 are drawn full.
 *   <UsageBar pct={92} alertPct={90} pendingPct={108} size="lg" label="IT & Systems budget used" />
 */
export default function UsageBar({ pct, alertPct, pendingPct = null, size = 'sm', label, className }) {
  const used = Math.min(100, Math.max(0, pct))
  const withPending = pendingPct === null ? used : Math.min(100, Math.max(used, pendingPct))
  const tone = usageTone(pct, alertPct)

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative flex overflow-hidden rounded-full bg-muted', size === 'lg' ? 'h-3' : 'h-1.5', className)}
    >
      <div className={cn('h-full', TONE_BAR[tone])} style={{ width: `${used}%` }} />
      {withPending > used && <div className="h-full bg-warning/70" style={{ width: `${withPending - used}%` }} />}
      {alertPct > 0 && alertPct < 100 && (
        <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ left: `${alertPct}%` }} />
      )}
    </div>
  )
}

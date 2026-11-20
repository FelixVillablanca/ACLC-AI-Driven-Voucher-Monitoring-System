import { Loader2 } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { alertCaption, alertPill, alertTitle, alertWhen } from '../utils'

/**
 * One alert (Framer mQcXDCyDZ card: 12px radius, 14/16 padding):
 * pill + time, title, who/where, and Review / Dismiss while it's still open.
 */
export default function AlertCard({ alert, busy, onReview, onDismiss }) {
  const pill = alertPill(alert)
  const open = alert.status === 'open'

  return (
    <article className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <Pill tone={pill.tone}>{pill.text}</Pill>
        <span className="text-caption shrink-0">{alertWhen(alert)}</span>
      </div>
      <h3 className="text-body-strong">{alertTitle(alert)}</h3>
      <p className="text-caption break-words">{alertCaption(alert)}</p>

      {open ? (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onReview}
            disabled={busy}
            className="text-auth-button flex h-8 items-center rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            Review
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="text-body-strong flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Dismiss
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onReview}
          className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          View details
        </button>
      )}
    </article>
  )
}

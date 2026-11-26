import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { draftExpiry } from '../utils'

const PROGRESS_TONES = {
  success: { text: 'text-success', bar: 'bg-success' },
  primary: { text: 'text-primary', bar: 'bg-primary' },
  warning: { text: 'text-warning', bar: 'bg-warning' },
  danger: { text: 'text-danger', bar: 'bg-danger' },
}

/**
 * One draft on the Drafts page (Framer Xfr2PEq2q): Draft / "Expires in N days" pill, when it was last edited,
 * payee, what it's for · category, amount, how complete it is (the SAME rule Submit uses, from the server)
 * with what's missing, then Delete + Continue editing. In Select mode the whole card ticks on and off.
 */
export default function DraftCard({ draft, selecting = false, selected = false, onToggle, onDelete }) {
  const expiry = draftExpiry(draft.expires_at)
  const { done = 0, total = 4, missing = [] } = draft.completeness ?? {}
  const pct = total ? Math.round((done / total) * 100) : 0
  const tone = pct === 100 ? 'success' : pct >= 75 ? 'primary' : pct >= 50 ? 'warning' : 'danger'
  const subtitle = [draft.summary ?? 'No description yet', draft.category?.name ?? 'Category not set'].join(' · ')

  const body = (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {selecting && (
            <span
              aria-hidden="true"
              className={cn(
                'flex size-[18px] items-center justify-center rounded border',
                selected ? 'border-primary bg-primary text-white' : 'bg-card',
              )}
            >
              {selected && <Check className="size-3" strokeWidth={3} />}
            </span>
          )}
          {expiry.soon ? <Pill tone="warning">{expiry.label}</Pill> : <Pill tone="neutral">Draft</Pill>}
        </div>
        <span className="text-caption" title={formatDate(draft.updated_at, 'MMM d, yyyy h:mm a')}>
          Edited {formatTimeAgo(draft.updated_at)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className={cn('text-card-title truncate', !draft.payee_name && 'text-muted-foreground')}>{draft.payee_name ?? 'Payee not set'}</p>
        <p className="text-caption truncate" title={subtitle}>
          {subtitle}
        </p>
      </div>

      <p className="text-stat-value tabular-nums">{formatMoney(draft.amount)}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-caption">
            {done} of {total} sections complete
          </span>
          <span className={cn('text-badge', PROGRESS_TONES[tone].text)}>{pct}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="How complete this draft is"
        >
          <div className={cn('h-full rounded-full', PROGRESS_TONES[tone].bar)} style={{ width: `${pct}%` }} />
        </div>
        <p className={cn('text-caption', missing.length === 0 && 'text-success')}>
          {missing.length ? `Missing: ${missing.join(', ')}` : '✓ Ready to submit'}
        </p>
      </div>
    </>
  )

  const card = cn(
    'flex flex-col gap-3 rounded-xl border bg-card p-4 text-left',
    expiry.soon && 'border-warning',
    selecting && selected && 'border-primary bg-primary-faint',
  )

  if (selecting) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${draft.payee_name ?? 'Draft'}, ${formatMoney(draft.amount)}`}
        onClick={() => onToggle(draft.id)}
        className={cn(card, 'outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50')}
      >
        {body}
      </button>
    )
  }

  return (
    <article className={card} aria-label={`${draft.payee_name ?? 'Draft'}, ${formatMoney(draft.amount)}`}>
      {body}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDelete(draft)}
          className="text-body-strong h-[34px] rounded-lg border bg-card px-3 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Delete
        </button>
        <Link
          to={`${PATHS.CLERK_VOUCHERS}/${draft.id}/edit`}
          className="text-auth-button flex h-[34px] flex-1 items-center justify-center rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Continue editing →
        </Link>
      </div>
    </article>
  )
}

import { Link } from 'react-router-dom'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { returnedByText } from '../utils'

/**
 * One voucher on Returned to me (Framer xRM5FKjDQ): number + "Returned · Level N" + payee · category, amount,
 * the reviewer's note (who, as which reviewer, when), then View details + Fix & resubmit.
 * Code differs from the frame (real data only): no "Needs changes: Line items / Attachments" tags (reviewers
 * can't tag parts yet) and no "N days left" (there's no resubmit deadline rule).
 */
export default function ReturnedCard({ voucher }) {
  const r = voucher.returned
  const initials =
    (r?.by ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  const subtitle = [voucher.payee_name ?? 'Payee not set', voucher.category?.name].filter(Boolean).join(' · ')

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] py-4"
      aria-label={`${voucher.voucher_number}, ${formatMoney(voucher.amount)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="text-card-title">{voucher.voucher_number}</h2>
          <Pill tone="danger">Returned{r?.step ? ` · Level ${r.step}` : ''}</Pill>
          <span className="text-body truncate text-muted-foreground">{subtitle}</span>
        </div>
        <p className="text-card-title tabular-nums">{formatMoney(voucher.amount)}</p>
      </div>

      <div className="flex gap-2.5 rounded-lg border-l-[3px] border-danger bg-muted px-3.5 py-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white',
            r?.step === 2 ? 'bg-primary-dark' : 'bg-primary',
          )}
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <p className="text-body-strong">
            {returnedByText(r)}
            {r?.at && (
              <span title={formatTimeAgo(r.at)}>
                {' · '}
                {formatDate(r.at, 'MMM d, h:mm a')}
              </span>
            )}
          </p>
          <p className={cn('text-body', !r?.remarks && 'text-muted-foreground')}>
            {r?.remarks ? `“${r.remarks}”` : 'No note was left. Open the voucher or ask the reviewer what to change.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-caption">
          {voucher.line_count === 1 ? '1 line item' : `${voucher.line_count} line items`} · last changed {formatTimeAgo(voucher.updated_at)}
        </p>
        <div className="flex gap-2">
          <Link
            to={`${PATHS.CLERK_VOUCHERS}/${voucher.id}`}
            className="text-body-strong flex h-[34px] items-center rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View details
          </Link>
          <Link
            to={`${PATHS.CLERK_VOUCHERS}/${voucher.id}/edit`}
            className="text-auth-button flex h-[34px] items-center rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Fix &amp; resubmit →
          </Link>
        </div>
      </div>
    </article>
  )
}

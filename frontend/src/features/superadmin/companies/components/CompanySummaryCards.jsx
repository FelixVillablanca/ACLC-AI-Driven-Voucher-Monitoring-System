import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * The 4 summary cards (Framer vnNFYExpX): Companies · Active · Suspended (amber when above 0) ·
 * Users across companies. Grey placeholders until the first answer arrives.
 */
export default function CompanySummaryCards({ summary }) {
  const cards = summary
    ? [
        { label: 'Companies', value: summary.total },
        { label: 'Active', value: summary.active },
        { label: 'Suspended', value: summary.suspended, warn: summary.suspended > 0 },
        { label: 'Users across companies', value: summary.users, hint: 'Super Admins are not counted' },
      ]
    : null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards
        ? cards.map((card) => (
            <div
              key={card.label}
              title={card.hint}
              className={cn('flex flex-col gap-0.5 rounded-xl border px-4 py-3', card.warn ? 'bg-warning-soft' : 'bg-card')}
            >
              <p className={card.warn ? 'text-badge text-warning' : 'text-caption'}>{card.label}</p>
              <p className="text-stat-value">{formatNumber(card.value)}</p>
            </div>
          ))
        : [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3" aria-hidden="true">
              <div className="h-3 w-24 animate-pulse rounded bg-border/70" />
              <div className="h-7 w-12 animate-pulse rounded bg-border/70" />
            </div>
          ))}
    </div>
  )
}

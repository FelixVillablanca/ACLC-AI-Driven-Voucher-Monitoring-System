import { cn } from '@/lib/utils'

/**
 * The 4 summary cards (Framer U7glXUOSF): Total accounts · Super Admin seats · Two-step on ·
 * Needs attention (amber when above 0). Grey placeholders until the first answer arrives.
 */
export default function AdminSummaryCards({ summary }) {
  const cards = summary
    ? [
        { label: 'Total accounts', value: summary.total_accounts },
        { label: 'Super Admin seats', value: `${summary.super_admin_seats.used} / ${summary.super_admin_seats.total}` },
        { label: 'Two-step sign-in on', value: `${summary.two_factor.on} of ${summary.two_factor.of}` },
        {
          label: 'Needs attention',
          value: summary.needs_attention,
          warn: summary.needs_attention > 0,
          hint: 'Pending invitations and accounts without two-step sign-in',
        },
      ]
    : null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards
        ? cards.map((card) => (
            <div
              key={card.label}
              title={card.hint}
              className={cn(
                'flex flex-col gap-0.5 rounded-xl border px-4 py-3',
                card.warn ? 'bg-warning-soft' : 'bg-card',
              )}
            >
              <p className={card.warn ? 'text-badge text-warning' : 'text-caption'}>{card.label}</p>
              <p className="text-stat-value">{card.value}</p>
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

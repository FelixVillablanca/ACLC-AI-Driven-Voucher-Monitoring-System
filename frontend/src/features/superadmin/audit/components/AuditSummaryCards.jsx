import { Lock } from 'lucide-react'
import { formatDate, formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * The 4 cards (Framer EJ0asP2ZH): events today · sensitive actions (7 days, amber) · failed sign-ins
 * (24 h, red) · kept forever (append-only). Always the whole platform, never the filters.
 * `onSensitive` turns on "Sensitive only" (AL6 outlines the card while it's on).
 */
export default function AuditSummaryCards({ summary, sensitiveOn, onSensitive }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Events today" value={formatNumber(summary.events_today)}>
        Across {plural(summary.companies_today, 'company', 'companies')}
      </Card>
      <button
        type="button"
        onClick={onSensitive}
        aria-pressed={sensitiveOn}
        className={cn(
          'flex flex-col gap-1 rounded-xl border bg-warning-soft px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          sensitiveOn && 'border-warning ring-1 ring-warning',
        )}
      >
        <span className="text-badge text-warning">Sensitive actions · 7 days</span>
        <span className="text-stat-value">{formatNumber(summary.sensitive_7d)}</span>
        <span className="text-caption">Role, access and settings changes</span>
      </button>
      <Card tone="danger" label="Failed sign-ins · 24 h" value={formatNumber(summary.failed_sign_ins_24h)}>
        {summary.top_failed_ip
          ? `${summary.top_failed_ip.count} from one IP address`
          : summary.failed_sign_ins_24h === 0
            ? 'None, all quiet'
            : 'From different addresses'}
      </Card>
      <Card label="Kept" value="Forever">
        <span className="flex items-center gap-1">
          <Lock className="size-3" aria-hidden="true" /> Append-only
          {summary.oldest_entry_at && ` · since ${formatDate(summary.oldest_entry_at, 'MMM yyyy')}`}
        </span>
      </Card>
    </div>
  )
}

function Card({ label, value, tone, children }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border px-4 py-3.5', tone === 'danger' ? 'bg-danger-soft' : 'bg-card')}>
      <span className={tone === 'danger' ? 'text-badge text-danger' : 'text-caption'}>{label}</span>
      <span className="text-stat-value">{value}</span>
      <span className="text-caption">{children}</span>
    </div>
  )
}

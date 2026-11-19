import { formatNumber } from '@/lib/formatters'
import Pill from '@/components/common/Pill'

/**
 * One of the 4 stat cards (Framer: label + icon tile, big number, pill + caption).
 *   <StatCard label="Users" icon={Users} value={46} pill={{ tone: 'success', text: '+5' }} caption="added this month" />
 */
export default function StatCard({ label, icon: Icon, value, pill, caption }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <p className="text-body text-muted-foreground">{label}</p>
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      {/* Numbers get thousands separators; text (e.g. a company name) is shown as is */}
      <p className="text-stat-value truncate" title={typeof value === 'string' ? value : undefined}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      <div className="flex min-h-5 flex-wrap items-center gap-1.5">
        {pill && <Pill tone={pill.tone}>{pill.text}</Pill>}
        {caption && <p className="text-caption">{caption}</p>}
      </div>
    </div>
  )
}

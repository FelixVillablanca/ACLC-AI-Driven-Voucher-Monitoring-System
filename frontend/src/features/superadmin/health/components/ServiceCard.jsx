import { Loader2 } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { statusPill } from '../utils'

/**
 * One service card (Framer m80KDanOj): name + status pill, a big number, a caption.
 * An unhealthy card gets an amber/red border. `checking` = SH1 "◌ Checking…".
 * `onOpen` makes the whole card a button (Background jobs opens SH4).
 */
export default function ServiceCard({ service, icon: Icon, label, status, value, caption, checking, checkedAt, extra, onOpen, children }) {
  const pill = statusPill(service, status, extra)
  const Tag = onOpen ? 'button' : 'div'

  return (
    <Tag
      type={onOpen ? 'button' : undefined}
      onClick={onOpen}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-xl border bg-card px-[18px] py-4 text-left',
        onOpen && 'outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
        status === 'warning' && 'border-warning bg-warning-soft/40',
        status === 'danger' && 'border-danger bg-danger-soft/40',
        checking && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-card-title truncate">{label}</span>
        </span>
        {checking ? (
          <span className="text-caption flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Checking…
          </span>
        ) : (
          <Pill tone={pill.tone}>
            {pill.text}
            {checkedAt && ` · ${formatTimeAgo(checkedAt)}`}
          </Pill>
        )}
      </div>
      <p className="text-stat-value">{value}</p>
      <p className="text-caption">{caption}</p>
      {children}
    </Tag>
  )
}

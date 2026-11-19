import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { cn } from '@/lib/utils'
import { describeAttention } from '../utils'

const ICON_TILES = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary-soft text-primary',
}

/**
 * "Needs your attention" (Framer uH0wO9f5O): one row per real problem, each with
 * a coloured icon tile, a title, a short explanation and ONE button that goes fix it.
 */
export default function AttentionCard({ items }) {
  const rows = items.map(describeAttention).filter(Boolean)

  return (
    <section aria-labelledby="attention-title" className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-2.5 border-b px-[18px] pt-4 pb-3.5">
        <h2 id="attention-title" className="text-card-title">
          Needs your attention
        </h2>
        {rows.length > 0 ? <Pill tone="danger">{rows.length} open</Pill> : <Pill tone="success">All clear</Pill>}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-3 px-[18px] py-6">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
            <CircleCheck className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-body-strong">Nothing needs your attention</p>
            <p className="text-caption">Backups, background jobs, security alerts and companies all look fine.</p>
          </div>
        </div>
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.title}
              className="flex flex-wrap items-center gap-3 border-b px-[18px] py-3 last:border-b-0 sm:flex-nowrap"
            >
              <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', ICON_TILES[row.tone])}>
                <row.icon className="size-4" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-body-strong">{row.title}</p>
                <p className="text-caption">{row.caption}</p>
              </div>
              <Link
                to={row.to}
                className="text-auth-link ml-11 flex h-8 shrink-0 items-center rounded-lg border bg-card px-3 text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 sm:ml-0"
              >
                {row.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

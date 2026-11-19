import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeAttention } from '../utils'
import Pill from './Pill'

/** "Needs attention": setup gaps the admin should fix (from the API's needs_attention list). */
export default function NeedsAttentionCard({ items }) {
  const rows = items.map(describeAttention).filter(Boolean)

  return (
    <section aria-labelledby="needs-attention" className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] pt-4 pb-[18px]">
      <div className="flex items-center justify-between">
        <h2 id="needs-attention" className="text-card-title">
          Needs attention
        </h2>
        {rows.length > 0 && <Pill tone="warning">{rows.length}</Pill>}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-success-soft px-3 py-2.5">
          <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-body-strong text-success">Everything is set up</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.text} className="flex gap-2.5">
              {/* chart-4 = the amber dot from the design */}
              <span
                aria-hidden="true"
                className={cn('mt-1.5 size-2 shrink-0 rounded-full', row.tone === 'warning' ? 'bg-chart-4' : 'bg-primary')}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-body-strong">{row.text}</p>
                <Link to={row.to} className="text-auth-link w-fit text-primary hover:underline">
                  {row.link}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

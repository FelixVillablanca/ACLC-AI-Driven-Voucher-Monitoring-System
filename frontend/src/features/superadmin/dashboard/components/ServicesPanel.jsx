import Pill from '@/components/common/Pill'
import { formatTimeAgo } from '@/lib/formatters'
import { describeService } from '../utils'

/**
 * The white "Services" card inside the welcome banner: one row per background part
 * (ML service, queue, scheduler, backup) with a coloured status pill.
 */
export default function ServicesPanel({ services, checkedAt, refreshFailed }) {
  return (
    <section
      aria-labelledby="services-title"
      className="flex w-full flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 lg:w-[320px] lg:shrink-0"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="services-title" className="text-table-head">
          Services
        </h2>
        <p className={refreshFailed ? 'text-caption text-warning' : 'text-caption'} aria-live="polite">
          {refreshFailed ? 'couldn’t refresh, retrying' : `checked ${formatTimeAgo(checkedAt)}`}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {services.map((service) => {
          const row = describeService(service)
          return (
            <li key={service.key} className="flex items-center justify-between gap-2">
              <span className="text-body">{row.name}</span>
              <Pill tone={row.tone}>{row.text}</Pill>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

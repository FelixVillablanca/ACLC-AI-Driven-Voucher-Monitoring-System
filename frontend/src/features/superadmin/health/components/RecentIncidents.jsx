import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const STATUS = {
  open: { tone: 'danger', text: 'Open' },
  watching: { tone: 'warning', text: 'Watching' },
  resolved: { tone: 'success', text: 'Fixed' },
}

/** "Recent incidents" (Framer m80KDanOj): newest first, unresolved on top. A row opens SH10. */
export default function RecentIncidents({ incidents, onOpen }) {
  // the audit log link shows the last 30 days (worked out once, not on every render)
  const [since] = useState(() => formatDate(new Date(Date.now() - 30 * 864e5), 'yyyy-MM-dd'))
  return (
    <section aria-labelledby="incidents-title" className="flex flex-col gap-2.5 rounded-xl border bg-card px-[18px] py-4">
      <h2 id="incidents-title" className="text-card-title">
        Recent incidents
      </h2>
      {incidents.length === 0 ? (
        <p className="text-caption flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" /> No incidents. One opens by itself when a service is unhealthy
          for 3 checks in a row.
        </p>
      ) : (
        <ul className="flex flex-col">
          {incidents.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onOpen(i.id)}
                className={cn(
                  'flex w-full items-start justify-between gap-2 border-b py-2 text-left outline-none last:border-b-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
              >
                <span className="min-w-0">
                  <span className="text-body-strong block truncate">
                    {formatDate(i.started_at, 'MMM d')} · {i.title}
                  </span>
                  <span className="text-caption">
                    {i.code} · {i.minutes} min
                  </span>
                </span>
                <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].text}</Pill>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`${PATHS.SUPERADMIN_AUDIT_LOGS}?action=incident_resolved&from=${since}`}
        className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        View in audit logs →
      </Link>
    </section>
  )
}

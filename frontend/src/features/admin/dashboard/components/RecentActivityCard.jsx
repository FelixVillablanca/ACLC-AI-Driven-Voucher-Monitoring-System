import { Link } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { PATHS } from '@/lib/constants'
import ActivityRow from './ActivityRow'

/** "Recent activity": the newest audit-log entries, or an empty state when there are none. */
export default function RecentActivityCard({ items }) {
  return (
    <section aria-labelledby="recent-activity" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] pt-4 pb-3.5">
        <div>
          <h2 id="recent-activity" className="text-card-title">
            Recent activity
          </h2>
          <p className="text-caption">Latest changes from the audit log</p>
        </div>
        <Link to={PATHS.ADMIN_AUDIT_LOGS} className="text-auth-link text-primary hover:underline">
          View all →
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity yet"
          description="Changes made by administrators (new users, companies, access) will appear here."
        />
      ) : (
        <ul>
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

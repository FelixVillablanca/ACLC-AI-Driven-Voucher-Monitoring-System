import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { CREATE_ADMIN_SEARCH } from '@/features/superadmin/admins'
import { SECURITY_ALERTS_SEARCH } from '@/features/superadmin/security'
import { formatDate, greeting } from '@/lib/formatters'
import { attentionSummary } from '../utils'
import ServicesPanel from './ServicesPanel'

/**
 * Primary Faint welcome banner (Framer uH0wO9f5O): date, greeting, how many things
 * need attention, the two main buttons, and the Services panel on the right.
 */
export default function WelcomeBanner({ firstName, attentionCount, companies, services, checkedAt, refreshFailed }) {
  return (
    <section className="flex flex-col gap-6 rounded-[14px] border border-primary-soft bg-primary-faint px-5 py-[22px] sm:px-6 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <p className="text-caption">{formatDate(new Date())}</p>
          <h1 className="text-page-title">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-body text-muted-foreground">{attentionSummary(attentionCount, companies)}</p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Opens the Create admin modal (Framer TkIHF89oH) on top of this page */}
          <Link
            to={{ search: CREATE_ADMIN_SEARCH }}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add admin
          </Link>
          {/* Opens the Security alerts panel (Framer mQcXDCyDZ) on top of this page */}
          <Link
            to={{ search: SECURITY_ALERTS_SEARCH }}
            className="text-auth-link flex h-[38px] items-center rounded-lg border bg-card px-3.5 text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Review security alerts
          </Link>
        </div>
      </div>

      <ServicesPanel services={services} checkedAt={checkedAt} refreshFailed={refreshFailed} />
    </section>
  )
}

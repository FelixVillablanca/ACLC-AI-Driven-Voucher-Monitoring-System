import { Link } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, Building2, Users } from 'lucide-react'
import { CREATE_USER_SEARCH } from '@/features/admin/users'
import { PATHS } from '@/lib/constants'

const ACTIONS = [
  { label: 'Add company', icon: Building2, to: PATHS.ADMIN_COMPANIES },
  { label: 'Create user', icon: Users, to: { search: CREATE_USER_SEARCH } }, // opens the Create user modal
  { label: 'Grant company access', icon: ArrowLeftRight, to: PATHS.ADMIN_COMPANY_ACCESS },
]

/** "Quick actions": shortcuts to the most common admin tasks. */
export default function QuickActionsCard() {
  return (
    <section aria-labelledby="quick-actions" className="flex flex-col gap-2.5 rounded-xl border bg-card px-[18px] pt-4 pb-[18px]">
      <h2 id="quick-actions" className="text-card-title">
        Quick actions
      </h2>
      {ACTIONS.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          className="group flex items-center gap-2.5 rounded-lg border bg-muted px-3 py-2.5 outline-none hover:border-primary/40 hover:bg-primary-faint focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-primary-soft text-primary">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-body-strong flex-1">{label}</span>
          <ArrowRight
            className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ))}
    </section>
  )
}

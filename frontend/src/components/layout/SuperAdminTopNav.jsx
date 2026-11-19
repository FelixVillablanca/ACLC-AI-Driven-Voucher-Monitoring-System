import { NavLink } from 'react-router-dom'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import TopNavUserMenu from './TopNavUserMenu'

/** The 6 tabs, in the Framer order. Only Overview is built; the others open "coming soon" pages for now. */
const TABS = [
  { to: PATHS.SUPERADMIN, label: 'Overview', end: true },
  { to: PATHS.SUPERADMIN_ADMINS, label: 'Admins' },
  { to: PATHS.SUPERADMIN_COMPANIES, label: 'Companies' },
  { to: PATHS.SUPERADMIN_SETTINGS, label: 'Global settings' },
  { to: PATHS.SUPERADMIN_AUDIT_LOGS, label: 'Audit logs' },
  { to: PATHS.SUPERADMIN_SYSTEM_HEALTH, label: 'System health' },
]

// Where the account menu items go
const ACCOUNT_LINKS = {
  profile: PATHS.SUPERADMIN_PROFILE,
  settings: PATHS.SUPERADMIN_ACCOUNT,
  changePassword: PATHS.SUPERADMIN_CHANGE_PASSWORD,
  activity: `${PATHS.SUPERADMIN_AUDIT_LOGS}?user=me`,
  help: PATHS.SUPERADMIN_HELP,
}

/**
 * 64px white top bar (Framer uH0wO9f5O): VM tile, "Super Admin console", amber "Platform owner" pill,
 * the tabs (active one = Primary text + 2px Primary underline), the bell and the avatar.
 *
 * Wide screens (lg+): everything in one row, like the design.
 * Smaller screens: the tabs move to a second row that scrolls sideways, so nothing is cut off.
 */
export default function SuperAdminTopNav({ onSignOut, notifications }) {
  return (
    <header className="shrink-0 border-b bg-card">
      <div className="flex h-16 items-center justify-between gap-6 px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            aria-hidden="true"
            className="text-badge flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-dark text-white"
          >
            VM
          </div>
          <p className="text-card-title truncate">Super Admin console</p>
          <span className="text-badge hidden shrink-0 rounded-full bg-hero-amber-soft px-2 py-0.5 text-warning sm:inline-flex">
            Platform owner
          </span>
        </div>

        <Tabs className="hidden h-16 lg:flex" />

        <div className="flex shrink-0 items-center gap-3">
          {notifications}
          <TopNavUserMenu onSignOut={onSignOut} links={ACCOUNT_LINKS} />
        </div>
      </div>

      <Tabs className="flex h-12 overflow-x-auto border-t px-4 sm:px-7 lg:hidden" />
    </header>
  )
}

function Tabs({ className }) {
  return (
    <nav aria-label="Super Admin" className={cn('items-stretch gap-[22px]', className)}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'flex shrink-0 items-center border-b-2 whitespace-nowrap outline-none focus-visible:text-primary',
              isActive
                ? 'text-auth-link border-primary text-primary'
                : 'text-body border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

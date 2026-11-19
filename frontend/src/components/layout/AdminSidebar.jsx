import { NavLink } from 'react-router-dom'
import { ArrowLeftRight, Building2, LayoutDashboard, Layers, ScrollText, Tags, Users, X } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import SidebarUserMenu from './SidebarUserMenu'

/** The admin menu, grouped exactly like the Framer frame (Nhw7N27tM). */
const NAV = [
  { items: [{ to: PATHS.ADMIN, label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    section: 'Organization',
    items: [
      { to: PATHS.ADMIN_COMPANIES, label: 'Companies', icon: Building2 },
      { to: PATHS.ADMIN_DEPARTMENTS, label: 'Departments', icon: Layers },
    ],
  },
  {
    section: 'People & Access',
    items: [
      { to: PATHS.ADMIN_USERS, label: 'Users', icon: Users },
      { to: PATHS.ADMIN_COMPANY_ACCESS, label: 'Company Access', icon: ArrowLeftRight },
    ],
  },
  { section: 'Configuration', items: [{ to: PATHS.ADMIN_CATEGORIES, label: 'Categories', icon: Tags }] },
  { section: 'System', items: [{ to: PATHS.ADMIN_AUDIT_LOGS, label: 'Audit Logs', icon: ScrollText }] },
]

// Where the account menu items go (Framer nj06iziQJ)
const ACCOUNT_LINKS = {
  profile: PATHS.ADMIN_PROFILE,
  settings: PATHS.ADMIN_SETTINGS,
  changePassword: PATHS.ADMIN_CHANGE_PASSWORD,
  activity: `${PATHS.ADMIN_AUDIT_LOGS}?user=me`,
  help: PATHS.ADMIN_HELP,
}

/**
 * 240px dark sidebar. On small screens it slides in as a drawer
 * (`onClose` shows an X button and closes it after a link is clicked).
 */
export default function AdminSidebar({ onSignOut, onClose }) {
  return (
    <aside className="flex h-full w-60 flex-col justify-between bg-sidebar px-3.5 pt-5 pb-4">
      <div className="flex min-h-0 flex-col gap-6">
        <div className="flex items-center justify-between px-1.5">
          <p className="text-nav-section text-on-dark-muted">Admin</p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex size-8 items-center justify-center rounded-md text-on-dark-muted hover:bg-on-dark-surface hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav aria-label="Admin" className="flex min-h-0 flex-col gap-[18px] overflow-y-auto">
          {NAV.map((group, i) => (
            <div key={group.section ?? i} className="flex flex-col gap-0.5">
              {group.section && <p className="text-nav-section px-3 pb-1.5 text-on-dark-muted/70">{group.section}</p>}
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isActive
                        ? 'bg-primary font-semibold text-white'
                        : 'font-medium text-on-dark-muted hover:bg-on-dark-surface hover:text-white',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <SidebarUserMenu onSignOut={onSignOut} links={ACCOUNT_LINKS} compact={Boolean(onClose)} />
    </aside>
  )
}

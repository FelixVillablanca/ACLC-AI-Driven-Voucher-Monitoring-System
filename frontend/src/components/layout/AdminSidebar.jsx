import { NavLink } from 'react-router-dom'
import { ArrowLeftRight, CreditCard, LayoutDashboard, Layers, ScrollText, Tags, UserSquare2, Users, X } from 'lucide-react'
import { ACCOUNT_PATHS, PATHS, ROLES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import SidebarUserMenu from './SidebarUserMenu'

/**
 * The admin menu. Redesigned 2026-11-22 (code first, no frame):
 * an Admin runs ONE company (chosen by the Super Admin), so there's no "Companies" item.
 * Their company is shown as a fixed card at the top instead, and every item below is about that company.
 */
const NAV = [
  { items: [{ to: PATHS.ADMIN, label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { section: 'Organization', items: [{ to: PATHS.ADMIN_DEPARTMENTS, label: 'Departments', icon: Layers }] },
  {
    section: 'People & access',
    items: [
      { to: PATHS.ADMIN_USERS, label: 'Users', icon: Users },
      { to: PATHS.ADMIN_COMPANY_ACCESS, label: 'Company access', icon: ArrowLeftRight },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { to: PATHS.ADMIN_CATEGORIES, label: 'Categories', icon: Tags },
      { to: PATHS.ADMIN_VOUCHER_TYPES, label: 'Voucher types', icon: CreditCard },
      { to: PATHS.ADMIN_PAYEE_TYPES, label: 'Payee types', icon: UserSquare2 },
    ],
  },
  { section: 'System', items: [{ to: PATHS.ADMIN_AUDIT_LOGS, label: 'Audit logs', icon: ScrollText }] },
]

// Where the account menu items go (the account pages, features/account)
const ACCOUNT_LINKS = ACCOUNT_PATHS[ROLES.ADMIN]

/** "Apex Holdings Inc." -> "AH" */
function companyInitials(name = '') {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join('') || '?'
  ).toUpperCase()
}

/**
 * 240px dark sidebar. On small screens it slides in as a drawer
 * (`onClose` shows an X button and closes it after a link is clicked).
 */
export default function AdminSidebar({ onSignOut, onClose }) {
  return (
    <aside className="flex h-full w-60 flex-col justify-between bg-sidebar px-3.5 pt-5 pb-4">
      <div className="flex min-h-0 flex-col gap-5">
        <div className="flex items-center justify-between gap-2 px-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              aria-hidden="true"
              className="text-badge flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white"
            >
              VM
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Admin console</p>
              <p className="text-caption truncate text-on-dark-muted">System setup</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-on-dark-muted hover:bg-on-dark-surface hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <CompanyCard />

        <nav aria-label="Admin" className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
          {NAV.map((group, i) => (
            <div key={group.section ?? i} className="flex flex-col gap-0.5">
              {group.section && <p className="text-nav-section px-3 pb-1 text-on-dark-muted/60">{group.section}</p>}
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={onClose} />
              ))}
            </div>
          ))}
        </nav>
      </div>

      <SidebarUserMenu onSignOut={onSignOut} links={ACCOUNT_LINKS} compact={Boolean(onClose)} />
    </aside>
  )
}

/** The one company this Admin runs. Read-only: only the Super Admin can change it. */
function CompanyCard() {
  const company = useAuthStore((s) => s.user?.company)

  if (!company) {
    return (
      <div className="rounded-xl border border-on-dark-border bg-on-dark-surface px-3 py-2.5">
        <p className="text-sm font-semibold text-white">No company assigned</p>
        <p className="text-caption mt-0.5 text-on-dark-muted">Ask a Super Admin to assign one to your account.</p>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border border-on-dark-border bg-on-dark-surface px-2.5 py-2.5"
      title="Everything in this menu is for this company only"
    >
      {company.logo ? (
        <img src={company.logo} alt="" className="size-9 shrink-0 rounded-lg bg-white object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="text-badge flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
        >
          {companyInitials(company.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-nav-section text-on-dark-muted/60">Your company</p>
        <p className="truncate text-sm font-semibold text-white">{company.name}</p>
        {company.type && <p className="text-caption truncate text-on-dark-muted">{company.type}</p>}
      </div>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          isActive
            ? 'bg-on-dark-surface font-semibold text-white'
            : 'font-medium text-on-dark-muted hover:bg-on-dark-surface hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* left accent bar on the open page */}
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-on-dark-muted transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
              isActive ? 'bg-primary text-white' : 'text-on-dark-muted group-hover:text-white',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {label}
        </>
      )}
    </NavLink>
  )
}

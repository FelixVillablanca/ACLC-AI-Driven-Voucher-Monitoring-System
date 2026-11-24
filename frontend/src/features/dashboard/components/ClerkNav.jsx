import { NavLink, useLocation } from 'react-router-dom'
import { CircleHelp, FilePen, FileText, LayoutDashboard, Plus, Undo2, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useClerkDashboard } from '../hooks/useClerkDashboard'

/**
 * The Accounting Clerk's sidebar menu (Framer LolF6YFo5). The counts are real (the dashboard data).
 * Drafts and Returned to me are My vouchers opened on that tab (?view=draft / ?view=returned), so the
 * highlighted item follows the tab. Help & guides opens "How vouchers get approved".
 * Payees has no page yet, so it's shown greyed out with "Soon", never as a link to nothing.
 */
export default function ClerkNav({ onNavigate }) {
  const { data } = useClerkDashboard()
  const { pathname, search } = useLocation()
  const counts = data?.counts
  const view = new URLSearchParams(search).get('view')
  const onList = pathname === PATHS.CLERK_VOUCHERS

  const groups = [
    { items: [{ to: PATHS.CLERK, label: 'Dashboard', icon: LayoutDashboard, active: pathname === PATHS.CLERK }] },
    {
      section: 'Vouchers',
      items: [
        { to: PATHS.CLERK_VOUCHER_NEW, label: 'Create voucher', icon: Plus, active: pathname === PATHS.CLERK_VOUCHER_NEW },
        {
          to: PATHS.CLERK_VOUCHERS,
          label: 'My vouchers',
          icon: FileText,
          count: counts?.all,
          // the list (any tab but Drafts / Returned) and a voucher's own pages
          active:
            (onList && view !== 'draft' && view !== 'returned') ||
            (pathname.startsWith(`${PATHS.CLERK_VOUCHERS}/`) && pathname !== PATHS.CLERK_VOUCHER_NEW),
        },
        {
          to: `${PATHS.CLERK_VOUCHERS}?view=draft`,
          label: 'Drafts',
          icon: FilePen,
          count: counts?.drafts,
          active: onList && view === 'draft',
        },
        {
          to: `${PATHS.CLERK_VOUCHERS}?view=returned`,
          label: 'Returned to me',
          icon: Undo2,
          count: counts?.returned,
          warn: true,
          active: onList && view === 'returned',
        },
      ],
    },
    {
      section: 'Reference',
      items: [
        { label: 'Payees', icon: Users },
        { to: PATHS.CLERK_APPROVAL_GUIDE, label: 'Help & guides', icon: CircleHelp, active: pathname === PATHS.CLERK_APPROVAL_GUIDE },
      ],
    },
  ]

  return (
    <nav aria-label="Accounting Clerk" className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
      {groups.map((group, i) => (
        <div key={group.section ?? i} className="flex flex-col gap-0.5">
          {group.section && <p className="text-nav-section px-3 pb-1 text-on-dark-muted/60">{group.section}</p>}
          {group.items.map((item) =>
            item.to ? <Item key={item.label} {...item} onClick={onNavigate} /> : <SoonItem key={item.label} {...item} />,
          )}
        </div>
      ))}
    </nav>
  )
}

const base = 'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors'

function Count({ count, warn }) {
  if (!count) return null
  return (
    <span className={cn('text-badge rounded-full px-1.5', warn ? 'bg-hero-amber text-primary-dark' : 'bg-on-dark-surface text-white')}>
      {count}
    </span>
  )
}

function Item({ to, label, icon: Icon, count, warn, active, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'bg-on-dark-surface font-semibold text-white' : 'font-medium text-on-dark-muted hover:bg-on-dark-surface hover:text-white',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-on-dark-muted', active ? 'opacity-100' : 'opacity-0')}
      />
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-primary text-white' : 'text-on-dark-muted',
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex-1">{label}</span>
      <Count count={count} warn={warn} />
    </NavLink>
  )
}

function SoonItem({ label, icon: Icon }) {
  return (
    <div
      className={cn(base, 'cursor-not-allowed font-medium text-on-dark-muted/70')}
      aria-disabled="true"
      title={`${label}: coming in a later update`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-[10px] font-semibold tracking-wide text-on-dark-muted/50 uppercase">Soon</span>
    </div>
  )
}

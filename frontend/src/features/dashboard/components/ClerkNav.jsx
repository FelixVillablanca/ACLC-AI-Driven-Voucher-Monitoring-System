import { NavLink } from 'react-router-dom'
import { CircleHelp, FilePen, FileText, LayoutDashboard, Plus, Undo2, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useClerkDashboard } from '../hooks/useClerkDashboard'

/**
 * The Accounting Clerk's sidebar menu (Framer LolF6YFo5). The counts are real (the dashboard data).
 * Only Dashboard has a page today: the voucher pages (Create, My vouchers, Drafts, Returned) come with
 * the voucher forms (Phase 3), and Payees / Help after that. Those items are shown greyed out with
 * "Soon", never as links to a page that doesn't exist.
 */
export default function ClerkNav({ onNavigate }) {
  const { data } = useClerkDashboard()
  const counts = data?.counts

  const groups = [
    { items: [{ to: PATHS.CLERK, label: 'Dashboard', icon: LayoutDashboard }] },
    {
      section: 'Vouchers',
      items: [
        { label: 'Create voucher', icon: Plus },
        { label: 'My vouchers', icon: FileText, count: counts?.all },
        { label: 'Drafts', icon: FilePen, count: counts?.drafts },
        { label: 'Returned to me', icon: Undo2, count: counts?.returned, warn: true },
      ],
    },
    {
      section: 'Reference',
      items: [
        { label: 'Payees', icon: Users },
        { label: 'Help & guides', icon: CircleHelp },
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

function Item({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          base,
          'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          isActive
            ? 'bg-on-dark-surface font-semibold text-white'
            : 'font-medium text-on-dark-muted hover:bg-on-dark-surface hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn('absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-on-dark-muted', isActive ? 'opacity-100' : 'opacity-0')}
          />
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md',
              isActive ? 'bg-primary text-white' : 'text-on-dark-muted',
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

function SoonItem({ label, icon: Icon, count, warn }) {
  return (
    <div
      className={cn(base, 'cursor-not-allowed font-medium text-on-dark-muted/70')}
      aria-disabled="true"
      title={`${label}: available once the voucher forms are built`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex-1">{label}</span>
      {count > 0 ? (
        <span className={cn('text-badge rounded-full px-1.5', warn ? 'bg-hero-amber text-primary-dark' : 'bg-on-dark-surface text-white')}>
          {count}
        </span>
      ) : (
        <span className="text-[10px] font-semibold tracking-wide text-on-dark-muted/50 uppercase">Soon</span>
      )}
    </div>
  )
}

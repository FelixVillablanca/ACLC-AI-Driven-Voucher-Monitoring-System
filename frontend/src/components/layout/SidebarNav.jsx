import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * The menu inside the dark operations sidebar (clerk, officer, supervisor), promoted from ClerkNav
 * 2026-11-26 when the officer's menu needed the same look.
 *   groups = [{ section?, items: [{ to?, label, icon, count?, tone?: 'warn'|'danger', active }] }]
 * An item without `to` has no page yet: it shows greyed out with "Soon", never as a link to nothing.
 */
export default function SidebarNav({ label, groups, onNavigate }) {
  return (
    <nav aria-label={label} className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1">
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

function Count({ count, tone }) {
  if (!count) return null
  return (
    <span
      className={cn(
        'text-badge rounded-full px-1.5',
        tone === 'danger' ? 'bg-danger text-white' : tone === 'warn' ? 'bg-hero-amber text-primary-dark' : 'bg-on-dark-surface text-white',
      )}
    >
      {count}
    </span>
  )
}

function Item({ to, label, icon: Icon, count, tone, active, onClick }) {
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
      <Count count={count} tone={tone} />
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

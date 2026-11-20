import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VIEWS } from '../utils'
import SortMenu from './SortMenu'

/**
 * Views + search + sort (Framer U7glXUOSF): a segmented control (All / Super Admins / Admins /
 * Pending / Inactive, each with its number) on the left; the 280px search and the sort menu on the right.
 * Controlled: the page owns the values (they live in the address bar).
 */
export default function AdminAccountsToolbar({ view, onView, counts, searchText, onSearchText, sort, order, onSort }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div
        role="tablist"
        aria-label="Views"
        className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-card p-[3px]"
      >
        {VIEWS.map((v) => {
          const active = (view ?? 'all') === v.key
          const amber = active && v.tone === 'warning'
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onView(v.key === 'all' ? null : v.key)}
              className={cn(
                'flex h-8 shrink-0 items-center rounded-md px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'text-badge' : 'text-caption hover:bg-muted',
                active && (amber ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'),
              )}
            >
              {v.label}
              {counts && ` ${counts[v.key] ?? 0}`}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-[38px] w-full items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:w-[280px]">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => onSearchText(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search name or email"
            className="text-body min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => onSearchText('')}
              aria-label="Clear search"
              className="flex size-[18px] items-center justify-center rounded-full bg-muted text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>
        <SortMenu sort={sort} order={order} onChange={onSort} />
      </div>
    </div>
  )
}

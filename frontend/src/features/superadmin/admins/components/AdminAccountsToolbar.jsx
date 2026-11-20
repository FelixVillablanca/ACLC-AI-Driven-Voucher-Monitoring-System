import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_OPTIONS, STATUS_CHIPS } from '../utils'

/**
 * Filter bar (Framer bxGFPLOVN): 300px search, status chips with counts, "Role: All ▾".
 * Controlled: the page owns the values (they live in the address bar).
 */
export default function AdminAccountsToolbar({ searchText, onSearchText, status, onStatus, role, onRole, counts }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex h-[38px] w-full items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:w-[300px]">
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
            className="flex size-5 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map((chip) => {
          const active = (status ?? 'all') === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => onStatus(chip.key === 'all' ? null : chip.key)}
              className={cn(
                'flex h-8 items-center rounded-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'text-badge border-primary bg-primary-soft text-primary' : 'text-caption bg-card hover:bg-muted',
              )}
            >
              {chip.label}
              {counts && ` ${counts[chip.key]}`}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <select
          value={role ?? ''}
          onChange={(e) => onRole(e.target.value || null)}
          aria-label="Filter by role"
          className="text-body h-[38px] cursor-pointer appearance-none rounded-lg border bg-card pr-8 pl-3 text-foreground outline-none focus-visible:border-primary focus-visible:ring-[0.5px] focus-visible:ring-primary"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ActionFilterMenu from './ActionFilterMenu'
import CheckBox from './CheckBox'
import CompanyFilterMenu from './CompanyFilterMenu'
import DateRangeMenu from './DateRangeMenu'

/**
 * The filter bar on top of the table: search (person, record or IP; ✕ clears), company (AL3),
 * action (AL4), date range (AL5) and "Sensitive only" (AL6).
 */
export default function AuditFilterBar({ searchText, onSearchText, filters, options, facets, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b px-4 py-3.5">
      <div
        className={cn(
          'flex h-[38px] min-w-[220px] flex-1 items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary',
          searchText && 'border-primary',
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={searchText}
          onChange={(e) => onSearchText(e.target.value)}
          placeholder="Search person, record or IP address…"
          aria-label="Search the audit log"
          className="text-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
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

      <CompanyFilterMenu
        options={options?.companies ?? []}
        counts={facets?.companies}
        value={filters.companies}
        onChange={(companies) => onChange({ companies })}
      />
      <ActionFilterMenu
        groups={options?.groups ?? []}
        counts={facets}
        value={filters.actions}
        onChange={(actions) => onChange({ actions })}
      />
      <DateRangeMenu value={{ from: filters.from, to: filters.to }} onChange={(range) => onChange(range)} />

      <CheckBox
        checked={filters.sensitive}
        onChange={(sensitive) => onChange({ sensitive })}
        className={cn('h-[38px] rounded-lg border px-3', filters.sensitive ? 'border-primary bg-primary-soft' : 'bg-card hover:bg-muted')}
      >
        <span className={filters.sensitive ? 'text-badge text-primary' : 'text-body'}>Sensitive only</span>
      </CheckBox>
    </div>
  )
}

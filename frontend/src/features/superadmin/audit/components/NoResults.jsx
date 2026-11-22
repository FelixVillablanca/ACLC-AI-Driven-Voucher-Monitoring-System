import { SearchX } from 'lucide-react'
import { rangeLabel } from '../utils'

/**
 * AL9 "No events match these filters": says, in a sentence, what was searched for, and offers
 * "Search all companies" (when a company filter is on) and "Clear filters".
 */
export default function NoResults({ filters, options, onAllCompanies, onClear }) {
  const companies = filters.companies.map((c) =>
    c === 'platform' ? 'platform-wide events' : (options?.companies?.find((x) => String(x.id) === c)?.name ?? 'that company'),
  )
  const suspended = options?.companies?.filter((c) => c.suspended && filters.companies.includes(String(c.id))) ?? []

  const parts = [
    filters.search ? `Nothing matches “${filters.search}”` : 'There are no events',
    companies.length ? `at ${companies.join(', ')}` : null,
    rangeLabel(filters).toLowerCase() === 'today' ? 'today' : `in ${rangeLabel(filters).toLowerCase()}`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border bg-muted text-primary" aria-hidden="true">
        <SearchX className="size-6" />
      </span>
      <h3 className="text-card-title">No events match these filters</h3>
      <p className="text-body max-w-[460px] text-muted-foreground">
        {parts.join(' ')}
        {filters.sensitive && ' among the sensitive actions'}.
        {suspended.length > 0 &&
          ` ${suspended.map((c) => c.name).join(', ')} ${suspended.length === 1 ? 'is' : 'are'} suspended, so almost nothing happens there.`}
      </p>
      <div className="flex flex-wrap justify-center gap-2.5 pt-1.5">
        {filters.companies.length > 0 && (
          <button
            type="button"
            onClick={onAllCompanies}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Search all companies
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}

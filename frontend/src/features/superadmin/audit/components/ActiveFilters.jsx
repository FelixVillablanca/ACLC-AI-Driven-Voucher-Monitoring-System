import { X } from 'lucide-react'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { presetOf, rangeLabel } from '../utils'

/**
 * "Filtered by [⚑ Sensitive only ✕] [Apex Holdings ✕] … · 3 of 1,284 events today · Clear all" (AL6).
 * Shown only when a filter is on. Each chip removes its own filter.
 */
export default function ActiveFilters({ filters, options, total, eventsToday, onChange, onClearAll }) {
  const chips = []
  if (filters.search) chips.push({ key: 'search', text: `“${filters.search}”`, remove: { search: '' } })
  filters.companies.forEach((c) => {
    const name = c === 'platform' ? 'Platform-wide' : (options?.companies?.find((x) => String(x.id) === c)?.name ?? `Company #${c}`)
    chips.push({ key: `c${c}`, text: name, remove: { companies: filters.companies.filter((x) => x !== c) } })
  })
  if (filters.actions.length)
    chips.push({ key: 'actions', text: plural(filters.actions.length, 'action type', 'action types'), remove: { actions: [] } })
  if (presetOf(filters) !== 'today') chips.push({ key: 'date', text: rangeLabel(filters), remove: { from: null, to: null } })
  if (filters.sensitive) chips.push({ key: 'sensitive', text: '⚑ Sensitive only', tone: 'warning', remove: { sensitive: false } })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/60 px-4 py-2.5">
      <span className="text-caption">Filtered by</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            'text-badge inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5',
            chip.tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary',
          )}
        >
          {chip.text}
          <button
            type="button"
            onClick={() => onChange(chip.remove)}
            aria-label={`Remove filter ${chip.text}`}
            className="flex size-4 items-center justify-center rounded-full outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <span className="text-caption ml-auto">
        {total != null && (presetOf(filters) === 'today' ? `${formatNumber(total)} of ${formatNumber(eventsToday)} events today` : plural(total, 'event', 'events'))}
      </span>
      <button type="button" onClick={onClearAll} className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
        Clear all
      </button>
    </div>
  )
}

import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { SECTIONS } from '../utils'

/**
 * The 232px left-hand section list: click to jump to a card; an amber dot marks a section with
 * unsaved edits. Underneath, "Last saved" (when, and by whom).
 *   active: the section in view   dirtyGroups: Set of section keys with edits
 */
export default function SectionNav({ active, dirtyGroups, onPick, lastSaved }) {
  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-1 rounded-xl border bg-card p-2.5 lg:sticky lg:top-20">
      <p className="text-table-head px-2.5 pt-1 pb-1.5 text-muted-foreground">Sections</p>
      {SECTIONS.map((s) => {
        const on = active === s.key
        return (
          <button
            key={s.key}
            type="button"
            aria-current={on ? 'true' : undefined}
            onClick={() => onPick(s.key)}
            className={cn(
              'flex h-[38px] items-center justify-between gap-2 rounded-lg px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              on ? 'text-badge bg-primary-soft text-primary' : 'text-body text-foreground hover:bg-muted',
            )}
          >
            <span className="truncate">{s.label}</span>
            {dirtyGroups.has(s.key) && (
              <span className="size-2 shrink-0 rounded-full bg-warning" aria-label="unsaved changes" />
            )}
          </button>
        )
      })}
      <div className="mt-1.5 flex flex-col gap-0.5 rounded-lg border-t bg-muted px-2.5 py-2.5">
        <p className="text-body-strong">Last saved</p>
        <p className="text-caption">
          {lastSaved
            ? `${formatDate(lastSaved.at, 'MMM d, yyyy · h:mm a')}${lastSaved.by ? ` by ${lastSaved.by}` : ' (platform defaults)'}`
            : 'Never changed: platform defaults'}
        </p>
      </div>
    </nav>
  )
}

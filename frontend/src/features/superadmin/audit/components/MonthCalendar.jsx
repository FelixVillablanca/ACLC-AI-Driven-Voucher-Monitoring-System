import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The month grid in the AL5 date panel. Click a start day, then an end day.
 * The chosen days are tinted, the ends filled; future days are greyed out and can't be picked.
 *   from / to: 'yyyy-MM-dd' (to may be null = today)   onPick(day: 'yyyy-MM-dd')
 */
export default function MonthCalendar({ from, to, onPick }) {
  const today = new Date()
  const start = from ? parseISO(from) : today
  const end = to ? parseISO(to) : today
  const [month, setMonth] = useState(startOfMonth(end))

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })
  const canGoNext = !isAfter(addMonths(month, 1), today)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Previous month"
          className="flex size-7 items-center justify-center rounded-md border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span className="text-body-strong">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={!canGoNext}
          aria-label="Next month"
          className="flex size-7 items-center justify-center rounded-md border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={format(month, 'MMMM yyyy')}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d} className="text-table-head py-1 text-muted-foreground">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const future = isAfter(day, today)
          const edge = isSameDay(day, start) || isSameDay(day, end)
          const inside = !edge && !isAfter(start, end) && isWithinInterval(day, { start, end })
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={future}
              onClick={() => onPick(format(day, 'yyyy-MM-dd'))}
              aria-pressed={edge || inside}
              aria-label={format(day, 'EEEE, MMMM d, yyyy')}
              className={cn(
                'mx-auto flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                !inMonth && 'invisible',
                future && 'text-muted-foreground/50 cursor-not-allowed',
                edge && 'text-badge bg-primary text-primary-foreground',
                inside && 'text-badge bg-primary-soft text-primary',
                !edge && !inside && !future && 'text-body hover:bg-muted',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

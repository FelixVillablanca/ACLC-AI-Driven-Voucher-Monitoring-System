import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DATE_PRESETS, presetOf, rangeDays, rangeLabel } from '../utils'
import FilterMenu, { MenuFooter } from './FilterMenu'
import MonthCalendar from './MonthCalendar'

/**
 * AL5 date range (540px): presets on the left (Today … Last month, Custom range), a month calendar
 * on the right, "8 days · logs are kept forever" underneath.
 *   value: { from, to }   onChange({ from, to })
 */
export default function DateRangeMenu({ value, onChange }) {
  const [draft, setDraft] = useState(value)
  const [picking, setPicking] = useState('from') // the next calendar click sets the start, then the end

  const preset = presetOf(draft)
  const isToday = presetOf(value) === 'today'

  const pickDay = (day) => {
    if (picking === 'from' || (draft.from && day < draft.from)) {
      setDraft({ from: day, to: day })
      setPicking('to')
    } else {
      setDraft((d) => ({ ...d, to: day }))
      setPicking('from')
    }
  }

  return (
    <FilterMenu
      label={rangeLabel(value)}
      active={!isToday}
      width={540}
      align="right"
      onOpen={() => {
        setDraft(value)
        setPicking('from')
      }}
      footer={({ close }) => (
        <MenuFooter
          onCancel={close}
          onApply={() => {
            const today = format(new Date(), 'yyyy-MM-dd')
            onChange({ from: draft.from, to: draft.to === today ? null : draft.to })
            close()
          }}
        />
      )}
    >
      {() => (
        <>
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0">
              {DATE_PRESETS.map((p) => {
                const on = preset === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setDraft(p.range())
                      setPicking('from')
                    }}
                    className={cn(
                      'flex h-8 items-center justify-between gap-2 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      on ? 'text-badge bg-primary-soft text-primary' : 'text-body hover:bg-muted',
                    )}
                  >
                    {p.label}
                    {on && <Check className="size-3.5" aria-hidden="true" />}
                  </button>
                )
              })}
              <span
                className={cn(
                  'flex h-8 items-center rounded-md px-2.5',
                  !preset ? 'text-badge bg-primary-soft text-primary' : 'text-body text-muted-foreground',
                )}
              >
                Custom range
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-3.5">
              <div className="flex items-center gap-2">
                <DateBox label="From" value={draft.from} active={picking === 'from'} onClick={() => setPicking('from')} />
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <DateBox label="To" value={draft.to} active={picking === 'to'} onClick={() => setPicking('to')} />
              </div>
              <MonthCalendar from={draft.from} to={draft.to} onPick={pickDay} />
            </div>
          </div>
          <p className="text-caption border-t px-3.5 py-2.5">
            {rangeDays(draft) === 1 ? '1 day' : `${rangeDays(draft)} days`} · logs are kept forever
          </p>
        </>
      )}
    </FilterMenu>
  )
}

function DateBox({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value ? format(parseISO(value), 'MMMM d, yyyy') : 'today'}`}
      className={cn(
        'text-body flex h-9 flex-1 items-center rounded-lg border px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'border-primary' : 'bg-card',
      )}
    >
      {value ? format(parseISO(value), 'MMM d, yyyy') : 'Today'}
    </button>
  )
}

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import CheckBox from './CheckBox'
import FilterMenu, { MenuFooter } from './FilterMenu'

/**
 * AL4 action filter (330px): 5 groups with counts; a group's checkbox ticks all its actions,
 * ▸ opens it to tick single actions. "Apply · 296 events".
 *   groups: [{ key, label, actions: [{ key, label }] }]
 *   counts: { groups: { security: 296 }, actions: { login: 12 } }   value: ['login', …]
 */
export default function ActionFilterMenu({ groups, counts, value, onChange }) {
  const [draft, setDraft] = useState(value)
  const [openGroup, setOpenGroup] = useState(null)

  const actionCount = (a) => counts?.actions?.[a] ?? 0
  const total = draft.reduce((sum, a) => sum + actionCount(a), 0)
  const label = value.length === 0 ? 'All actions' : plural(value.length, 'action type', 'action types')

  const setGroup = (group, on) =>
    setDraft((d) => {
      const keys = group.actions.map((a) => a.key)
      return on ? [...new Set([...d, ...keys])] : d.filter((k) => !keys.includes(k))
    })
  const setAction = (key, on) => setDraft((d) => (on ? [...d, key] : d.filter((k) => k !== key)))

  return (
    <FilterMenu
      label={label}
      active={value.length > 0}
      width={330}
      onOpen={() => {
        setDraft(value)
        setOpenGroup(groups.find((g) => g.actions.some((a) => value.includes(a.key)))?.key ?? null)
      }}
      footer={({ close }) => (
        <MenuFooter
          onCancel={close}
          applyLabel={draft.length === 0 ? 'Show all actions' : `Apply · ${formatNumber(total)} ${total === 1 ? 'event' : 'events'}`}
          onApply={() => {
            onChange(draft)
            close()
          }}
        />
      )}
    >
      {() => (
        <>
          <div className="text-caption flex items-center justify-between border-b px-3.5 py-2.5">
            <span>{draft.length === 0 ? 'Every action' : `${plural(draft.length, 'action type', 'action types')} selected`}</span>
            <button type="button" onClick={() => setDraft([])} className="text-auth-link rounded text-primary hover:underline">
              Clear
            </button>
          </div>
          <div className="flex max-h-80 flex-col overflow-y-auto p-1.5">
            {groups.map((g) => {
              const keys = g.actions.map((a) => a.key)
              const ticked = keys.filter((k) => draft.includes(k)).length
              const all = ticked === keys.length && keys.length > 0
              const expanded = openGroup === g.key
              return (
                <div key={g.key} className="flex flex-col">
                  <div className={cn('flex items-center gap-1 rounded-lg px-2 py-2', all && 'bg-primary-faint')}>
                    <CheckBox checked={all} onChange={(v) => setGroup(g, v)} label={g.label} className="min-w-0 flex-1">
                      <span className={cn('min-w-0 flex-1 truncate', ticked ? 'text-badge text-primary' : 'text-body-strong')}>
                        {g.label}
                        {ticked > 0 && !all && <span className="text-caption"> · {ticked} of {keys.length}</span>}
                      </span>
                    </CheckBox>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Hide' : 'Show'} the ${g.label} actions`}
                      onClick={() => setOpenGroup(expanded ? null : g.key)}
                      className="text-caption flex items-center gap-1 rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {formatNumber(counts?.groups?.[g.key] ?? 0)}
                      {expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                    </button>
                  </div>
                  {expanded && (
                    <div className="mb-1 ml-8 flex flex-col gap-1.5 pb-1">
                      {g.actions.map((a) => (
                        <CheckBox key={a.key} checked={draft.includes(a.key)} onChange={(v) => setAction(a.key, v)}>
                          <span className="text-body min-w-0 flex-1 truncate">{a.label}</span>
                          <span className="text-caption pr-2">{formatNumber(actionCount(a.key))}</span>
                        </CheckBox>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </FilterMenu>
  )
}

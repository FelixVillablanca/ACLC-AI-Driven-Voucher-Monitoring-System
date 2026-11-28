import { useState } from 'react'
import { Search } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { formatNumber } from '@/lib/formatters'
import CheckBox from './CheckBox'
import FilterMenu, { MenuFooter } from './FilterMenu'

/**
 * AL3 company filter (300px): find a company, tick several, "Platform-wide (no company)",
 * event counts per row (with the other filters), "Apply · 1,043 events".
 *   options: [{ id, name, suspended }]   counts: { [id]: n, platform: n }   value: ['3', 'platform']
 */
export default function CompanyFilterMenu({ options, counts = {}, value, onChange }) {
  const [draft, setDraft] = useState(value)
  const [find, setFind] = useState('')

  const rows = [
    ...options.map((c) => ({ key: String(c.id), name: c.name, suspended: c.suspended })),
    { key: 'platform', name: 'Platform-wide (no company)' },
  ]
  const shown = rows.filter((r) => r.name.toLowerCase().includes(find.trim().toLowerCase()))
  const total = draft.length === 0 ? null : draft.reduce((sum, k) => sum + (counts[k] ?? 0), 0)

  const label =
    value.length === 0
      ? 'All companies'
      : value.length === 1
        ? (rows.find((r) => r.key === value[0])?.name ?? '1 company')
        : `${value.length} companies`

  const toggle = (key, on) => setDraft((d) => (on ? [...d, key] : d.filter((k) => k !== key)))

  return (
    <FilterMenu
      label={label}
      active={value.length > 0}
      width={300}
      onOpen={() => {
        setDraft(value)
        setFind('')
      }}
      footer={({ close }) => (
        <MenuFooter
          onCancel={close}
          applyLabel={total === null ? 'Show all companies' : `Apply · ${formatNumber(total)} ${total === 1 ? 'event' : 'events'}`}
          onApply={() => {
            onChange(draft)
            close()
          }}
        />
      )}
    >
      {() => (
        <>
          <div className="flex flex-col gap-2 border-b p-3">
            <div className="flex h-9 items-center gap-2 rounded-lg border px-2.5 focus-within:border-primary">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <input
                autoFocus
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find a company…"
                aria-label="Find a company"
                className="text-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="text-caption flex items-center justify-between">
              <span>{draft.length === 0 ? 'All shown' : `${draft.length} of ${rows.length} selected`}</span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(rows.map((r) => r.key))}
                  className="text-auth-link rounded text-primary hover:underline"
                >
                  Select all
                </button>
                <button type="button" onClick={() => setDraft([])} className="text-auth-link rounded text-primary hover:underline">
                  Clear
                </button>
              </span>
            </div>
          </div>
          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1.5">
            {shown.length === 0 && <p className="text-caption px-2 py-3">No company matches “{find}”.</p>}
            {shown.map((r) => {
              const on = draft.includes(r.key)
              return (
                <CheckBox key={r.key} checked={on} onChange={(v) => toggle(r.key, v)} className="rounded-lg px-2 py-2 hover:bg-muted">
                  <span className={on ? 'text-body-strong min-w-0 flex-1 truncate' : 'text-body min-w-0 flex-1 truncate'}>{r.name}</span>
                  {r.suspended ? (
                    <Pill tone="warning">Suspended</Pill>
                  ) : (
                    <span className="text-caption">{formatNumber(counts[r.key] ?? 0)}</span>
                  )}
                </CheckBox>
              )
            })}
          </div>
        </>
      )}
    </FilterMenu>
  )
}

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SORTS } from '../utils'

/** "Sort: Last sign-in ▾" and its menu (A4, frame F_8EeA4fN): what to sort by + newest / oldest first. */
export default function SortMenu({ sort, order, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = SORTS.find((s) => s.key === sort) ?? SORTS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (changes) => {
    onChange(changes)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'text-body flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
          open && 'border-primary',
        )}
      >
        Sort: {current.short}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1 w-64 rounded-xl border bg-card p-1 shadow-lg">
          <p className="text-table-head px-2.5 pt-1.5 pb-1 text-muted-foreground">Sort by</p>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="menuitemradio"
              aria-checked={s.key === current.key}
              onClick={() => pick({ sort: s.key })}
              className="text-body flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
            >
              {s.label}
              {s.key === current.key && <Check className="size-4 text-primary" aria-hidden="true" />}
            </button>
          ))}
          <p className="text-table-head border-t px-2.5 pt-2 pb-1 text-muted-foreground">Order</p>
          <div className="flex gap-1 p-1">
            {[
              { key: 'desc', label: 'Newest first', icon: ArrowDown },
              { key: 'asc', label: 'Oldest first', icon: ArrowUp },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={order === o.key}
                onClick={() => pick({ order: o.key })}
                className={cn(
                  'flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  order === o.key ? 'text-badge border-primary bg-primary-soft text-primary' : 'text-caption hover:bg-muted',
                )}
              >
                <o.icon className="size-3.5" aria-hidden="true" />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

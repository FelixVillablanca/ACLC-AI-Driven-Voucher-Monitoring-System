import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import Switch from '@/components/common/Switch'
import { cn } from '@/lib/utils'
import { SORTS } from '../utils'

/**
 * "Sort: Name A–Z ▾" and its 220px menu (C3, frame oqxhehYHx): six orders, and a
 * "Suspended first" switch in the Muted footer.
 */
export default function CompanySortMenu({ sort, suspendedFirst, onChange }) {
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'text-body flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3 whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
          open && 'border-primary',
        )}
      >
        Sort: {current.label}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div role="menu" className="absolute top-full right-0 z-30 mt-1 w-[220px] overflow-hidden rounded-xl border bg-card shadow-lg">
          <p className="text-table-head px-3.5 pt-2.5 pb-1.5 text-muted-foreground">Sort by</p>
          <div className="flex flex-col gap-0.5 px-1.5 pb-1.5">
            {SORTS.map((s) => {
              const on = s.key === current.key
              return (
                <button
                  key={s.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    onChange({ sort: s.key })
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left outline-none focus-visible:bg-muted',
                    on ? 'text-auth-link bg-primary-faint text-primary' : 'text-body hover:bg-muted',
                  )}
                >
                  {s.label}
                  {on && <Check className="size-4" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-2 border-t bg-muted px-3.5 py-2.5">
            <span className="text-caption">Suspended first</span>
            <Switch size="sm" checked={suspendedFirst} onChange={(on) => onChange({ suspendedFirst: on })} />
          </label>
        </div>
      )}
    </div>
  )
}

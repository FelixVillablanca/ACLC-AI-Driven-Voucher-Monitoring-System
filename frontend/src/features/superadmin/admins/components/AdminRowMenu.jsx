import { useEffect, useRef, useState } from 'react'
import { KeyRound, Lock, LockOpen, Mail, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { key: 'resend_invitation', label: 'Resend invitation', icon: Mail },
  { key: 'reset_password', label: 'Send password reset', icon: KeyRound },
  { key: 'unlock', label: 'Unlock account', icon: LockOpen },
  { key: 'lock', label: 'Lock account', icon: Lock, danger: true },
]

/** Rough menu height, to decide whether it fits below the button or must open upwards. */
const MENU_ROW_PX = 38

/**
 * The ⋯ button at the end of a row. Shows only the actions the server says are allowed
 * for this account (row.actions). Closes on a click outside, Esc, scrolling, or after choosing.
 *
 * The menu is placed against the WINDOW (position: fixed), not the table, because the
 * table can scroll sideways and would otherwise cut the menu off on the last rows.
 */
export default function AdminRowMenu({ account, onChoose }) {
  const [place, setPlace] = useState(null) // null = closed, else { top | bottom, right }
  const rootRef = useRef(null)
  const items = ITEMS.filter((item) => account.actions[item.key])
  const open = place !== null

  const toggle = (e) => {
    if (open) return setPlace(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const right = window.innerWidth - rect.right
    const needed = items.length * MENU_ROW_PX + 16
    setPlace(
      rect.bottom + needed > window.innerHeight
        ? { bottom: window.innerHeight - rect.top + 4, right }
        : { top: rect.bottom + 4, right },
    )
  }

  useEffect(() => {
    if (!open) return
    const close = () => setPlace(null)
    const onDown = (e) => !rootRef.current?.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true) // any scrolling area
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${account.full_name}`}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          open && 'bg-muted text-foreground',
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" style={place} className="fixed z-40 w-56 rounded-xl border bg-card p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setPlace(null)
                onChoose(item.key, account)
              }}
              className={cn(
                'text-body flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted',
                item.danger && 'text-danger',
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

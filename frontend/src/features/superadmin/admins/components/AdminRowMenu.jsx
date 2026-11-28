import { useEffect, useRef, useState } from 'react'
import { Ban, CircleUserRound, KeyRound, Mail, MailX, MoreHorizontal, Pencil, RotateCcw, ShieldCheck, Star } from 'lucide-react'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/** Rough menu height per row, to decide whether it fits below the button or must open upwards. */
const MENU_ROW_PX = 38

/**
 * The ⋯ menu at the end of a row (A7, frame P0pLQLVaa). Shows the actions the server allows for
 * this account (row.actions); "Make Super Admin" also shows the seats left. Closes on a click
 * outside, Esc, scrolling, or after choosing.
 *
 * The menu is placed against the WINDOW (position: fixed), not the table, because the table
 * can scroll sideways and would otherwise cut the menu off on the last rows.
 */
export default function AdminRowMenu({ account, seatsLeft, onChoose }) {
  const [place, setPlace] = useState(null) // null = closed, else { top | bottom, right }
  const rootRef = useRef(null)
  const a = account.actions

  const items = [
    { key: 'profile', label: 'View profile', icon: CircleUserRound, show: true },
    { key: 'edit', label: 'Edit details', icon: Pencil, show: a.edit },
    { key: 'resend_invitation', label: 'Resend invitation', icon: Mail, show: a.resend_invitation },
    { key: 'reset_password', label: 'Send password reset', icon: KeyRound, show: a.reset_password },
    { key: 'require_two_factor', label: 'Require two-step sign-in', icon: ShieldCheck, show: a.require_two_factor },
    {
      key: 'make_super_admin',
      label: 'Make Super Admin',
      icon: Star,
      show: account.role === 'admin' && account.status !== 'pending',
      disabled: !a.make_super_admin,
      note: seatsLeft > 0 ? `${plural(seatsLeft, 'seat', 'seats')} left` : 'No seats left',
    },
    { key: 'reactivate', label: 'Reactivate account', icon: RotateCcw, show: a.reactivate },
    { key: 'cancel_invitation', label: 'Cancel invite', icon: MailX, show: a.cancel_invitation, danger: true },
    { key: 'deactivate', label: 'Deactivate account', icon: Ban, show: a.deactivate, danger: true },
  ].filter((item) => item.show)

  const toggle = (e) => {
    if (place) return setPlace(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const right = window.innerWidth - rect.right
    const needed = items.length * MENU_ROW_PX + 70
    setPlace(
      rect.bottom + needed > window.innerHeight
        ? { bottom: Math.max(8, window.innerHeight - rect.top + 4), right }
        : { top: rect.bottom + 4, right },
    )
  }

  useEffect(() => {
    if (!place) return
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
  }, [place])

  return (
    <div ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={Boolean(place)}
        aria-label={`Actions for ${account.full_name}`}
        className={cn(
          'flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          place && 'bg-muted text-foreground',
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {place && (
        <div role="menu" style={place} className="fixed z-40 w-64 rounded-xl border bg-card p-1 shadow-lg">
          <div className="border-b px-2.5 pt-1.5 pb-2">
            <p className="text-body-strong truncate">{account.full_name}</p>
            <p className="text-caption truncate">
              {account.role === 'super_admin' ? 'Super Admin' : 'Admin'} · {account.email}
            </p>
          </div>
          <div className="pt-1">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setPlace(null)
                  onChoose(item.key, account)
                }}
                className={cn(
                  'text-body flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                  item.danger && 'text-danger',
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.note && <span className="text-caption">{item.note}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CircleHelp, KeyRound, Loader2, Power, ScrollText, Settings, UserRound } from 'lucide-react'
import { formatInitials, formatSignInTime } from '@/lib/formatters'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const itemClass =
  'text-body flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted'

/**
 * The account menu that opens from ⋮ (Framer nj06iziQJ, 264px card).
 * Keyboard: ↑/↓ move between items, Esc closes (handled by the parent too).
 */
export default function UserMenuPanel({ user, links, signingOut, onSignOut, onClose, className }) {
  const panelRef = useRef(null)

  // Accessibility: put keyboard focus on the first item when the menu opens
  useEffect(() => {
    panelRef.current?.querySelector('[role="menuitem"]')?.focus()
  }, [])

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = [...panelRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')]
    const index = items.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    items[(next + items.length) % items.length]?.focus()
  }

  const lastSignIn = formatSignInTime(user?.last_login_at)

  return (
    <motion.div
      ref={panelRef}
      role="menu"
      aria-label="Account"
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={cn(
        'z-50 flex w-[264px] max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-xl border bg-card p-1.5 text-foreground shadow-xl shadow-foreground/10',
        className,
      )}
    >
      {/* Who is signed in */}
      <div className="flex items-center gap-2.5 p-2.5">
        <div className="text-badge flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {formatInitials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-strong truncate">{user?.full_name}</p>
          <p className="text-caption truncate" title={user?.email}>{user?.email}</p>
        </div>
        <span className="text-badge shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-primary">
          {ROLE_SHORT_LABELS[user?.role] ?? user?.role}
        </span>
      </div>

      <div role="separator" className="h-px bg-border" />

      <MenuLink to={links.profile} icon={UserRound} onClick={onClose}>
        My profile
      </MenuLink>
      <MenuLink to={links.settings} icon={Settings} onClick={onClose}>
        Account settings
      </MenuLink>
      <MenuLink to={links.changePassword} icon={KeyRound} onClick={onClose}>
        Change password
      </MenuLink>
      <MenuLink to={links.activity} icon={ScrollText} onClick={onClose} hint="Audit log">
        My activity
      </MenuLink>
      <MenuLink to={links.help} icon={CircleHelp} onClick={onClose}>
        Help &amp; support
      </MenuLink>

      <div role="separator" className="h-px bg-border" />

      <button
        type="button"
        role="menuitem"
        onClick={onSignOut}
        disabled={signingOut}
        className={cn(itemClass, 'font-medium text-danger hover:bg-danger-soft focus-visible:bg-danger-soft disabled:opacity-60')}
      >
        <span className="flex size-[18px] items-center justify-center">
          {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Power className="size-4" aria-hidden="true" />}
        </span>
        <span className="flex-1">{signingOut ? 'Signing out…' : 'Sign out'}</span>
      </button>

      {lastSignIn && <p className="text-caption px-2.5 pt-1.5 pb-1">Last sign-in: {lastSignIn}</p>}
    </motion.div>
  )
}

function MenuLink({ to, icon: Icon, hint, onClick, children }) {
  return (
    <Link to={to} role="menuitem" onClick={onClick} className={itemClass}>
      <span className="flex size-[18px] items-center justify-center text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-caption">{hint}</span>}
    </Link>
  )
}

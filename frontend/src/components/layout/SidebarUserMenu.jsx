import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { EllipsisVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROLE_LABELS, ROLES } from '@/lib/constants'
import { formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import UserMenuPanel from './UserMenuPanel'

/**
 * The signed-in user at the bottom of the sidebar (Framer: avatar, name, role, ⋮).
 * Clicking ⋮ opens the account menu (Framer nj06iziQJ):
 *   - wide screens: to the RIGHT of the sidebar, lined up with the card's bottom
 *   - inside the mobile drawer (`compact`): ABOVE the card, so it fits on a phone
 * `onSignOut` and `links` come from the layout, so this shared component never
 * imports a feature directly (dependency rule).
 */
export default function SidebarUserMenu({ onSignOut, links, compact = false }) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Close when clicking outside, or pressing Escape (focus goes back to ⋮)
  useEffect(() => {
    if (!open) return
    const onClick = (e) => !wrapperRef.current?.contains(e.target) && close()
    const onKey = (e) => e.key === 'Escape' && close(true)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await onSignOut()
    } catch (error) {
      toast.error(`Couldn't sign out: ${error.message}`)
      setSigningOut(false)
    }
  }

  const roleLabel = user?.role === ROLES.ADMIN ? 'System Administrator' : ROLE_LABELS[user?.role]

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-[10px] p-2.5 transition-colors',
          open ? 'bg-on-dark-border' : 'bg-on-dark-surface',
        )}
      >
        <div className="text-badge flex size-8.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          {formatInitials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
          <p className="text-brand-small truncate text-on-dark-muted">{roleLabel}</p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'flex size-7 items-center justify-center rounded-md outline-none hover:bg-on-dark-surface hover:text-white focus-visible:ring-2 focus-visible:ring-ring/50',
            open ? 'text-white' : 'text-on-dark-muted',
          )}
        >
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <UserMenuPanel
            user={user}
            links={links}
            signingOut={signingOut}
            onSignOut={handleSignOut}
            onClose={() => close()}
            className={cn('absolute', compact ? 'bottom-full left-0 mb-2' : 'bottom-0 left-full ml-[26px]')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

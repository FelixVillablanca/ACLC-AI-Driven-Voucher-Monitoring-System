import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import UserMenuPanel from './UserMenuPanel'

/**
 * The round avatar in a top bar (Framer uH0wO9f5O "FV"). Clicking it opens the same
 * account menu the admin sidebar uses (UserMenuPanel), just below the avatar.
 * The Super Admin version of the menu has its own frame (PSEjFM9zW); its extra
 * items come when that frame is built.
 */
export default function TopNavUserMenu({ onSignOut, links }) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Close when clicking outside, or pressing Escape (focus goes back to the avatar)
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${user?.full_name ?? 'you'}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'text-badge flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50',
          open && 'ring-3 ring-primary-soft',
        )}
      >
        {formatInitials(user)}
      </button>

      <AnimatePresence>
        {open && (
          <UserMenuPanel
            user={user}
            links={links}
            signingOut={signingOut}
            onSignOut={handleSignOut}
            onClose={() => close()}
            className="absolute top-full right-0 mt-2"
          />
        )}
      </AnimatePresence>
    </div>
  )
}

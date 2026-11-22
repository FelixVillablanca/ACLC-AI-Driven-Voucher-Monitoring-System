import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUnreadCount } from '../hooks/useUnreadCount'
import NotificationPanel from './NotificationPanel'

/**
 * The 🔔 button in the top bar + its dropdown panel (Framer D7aTKQEDz).
 * A small badge shows how many notifications are unread.
 *
 *   links = {
 *     viewAll: '/admin/notifications',
 *     categories: { security: '/admin/audit-logs', access: '/admin/company-access', … },
 *   }
 */
export default function NotificationBell({ links }) {
  const [open, setOpen] = useState(false)
  const { count, setCount, refresh } = useUnreadCount()
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  // Close on outside click or Escape
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

  const toggle = () => {
    if (open) refresh() // re-check the badge when closing
    setOpen((v) => !v)
  }

  return (
    <div ref={wrapperRef} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'relative flex size-[38px] items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
          open && 'border-primary/40 bg-primary-faint',
        )}
      >
        <Bell className="size-4" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-card">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <NotificationPanel
            unreadCount={count}
            onCountChange={setCount}
            links={links}
            onClose={() => close()}
            className="fixed inset-x-4 top-[72px] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[392px]"
          />
        )}
      </AnimatePresence>
    </div>
  )
}

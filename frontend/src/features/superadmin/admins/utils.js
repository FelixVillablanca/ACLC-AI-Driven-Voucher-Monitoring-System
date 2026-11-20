import { format, isToday, isYesterday } from 'date-fns'
import { formatTimeAgo } from '@/lib/formatters'

/** Fired after an Admin is created, locked, unlocked or reset, so lists and the dashboard refresh. */
export const ADMINS_CHANGED_EVENT = 'advms:admins-changed'

/** Add this to the current address to open the Create admin modal from any Super Admin page. */
export const CREATE_ADMIN_SEARCH = '?create=admin'

export function announceAdminsChanged() {
  window.dispatchEvent(new CustomEvent(ADMINS_CHANGED_EVENT))
}

/** The status chips on the Admin accounts page (Framer bxGFPLOVN). */
export const STATUS_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'inactive', label: 'Inactive' },
]

export const ROLE_OPTIONS = [
  { value: '', label: 'Role: All' },
  { value: 'super_admin', label: 'Role: Super Admin' },
  { value: 'admin', label: 'Role: Admin' },
]

/** Role pill: Super Admin = amber, Admin = indigo (as in the frame). */
export function rolePill(role) {
  return role === 'super_admin'
    ? { tone: 'warning', className: 'bg-hero-amber-soft', text: 'Super Admin' }
    : { tone: 'primary', className: undefined, text: 'Admin' }
}

export function statusPill(status) {
  return (
    {
      active: { tone: 'success', text: 'Active' },
      pending: { tone: 'warning', text: 'Pending' },
      inactive: { tone: 'neutral', text: 'Inactive' },
    }[status] ?? { tone: 'neutral', text: status }
  )
}

/** "Now" (you) / "5 min ago" / "2 h ago" / "Yesterday" / "Nov 9, 2026" / "Never signed in" */
export function lastSignInText(account) {
  if (account.is_you) return 'Now'
  if (!account.last_login_at) return 'Never signed in'
  const date = new Date(account.last_login_at)
  if (isToday(date)) return formatTimeAgo(date)
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

/** "Jan 5, 2026" */
export function createdText(value) {
  return value ? format(new Date(value), 'MMM d, yyyy') : '—'
}

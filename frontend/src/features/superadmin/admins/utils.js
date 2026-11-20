import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns'
import { formatTimeAgo, plural } from '@/lib/formatters'

/** Fired after an Admin is created / changed / deactivated…, so lists and the dashboard refresh. */
export const ADMINS_CHANGED_EVENT = 'advms:admins-changed'

/** Add this to the current address to open the Create admin modal from any Super Admin page. */
export const CREATE_ADMIN_SEARCH = '?create=admin'

export function announceAdminsChanged() {
  window.dispatchEvent(new CustomEvent(ADMINS_CHANGED_EVENT))
}

/** The segmented views on the Admins tab (Framer U7glXUOSF). */
export const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'super_admins', label: 'Super Admins' },
  { key: 'admins', label: 'Admins' },
  { key: 'pending', label: 'Pending', tone: 'warning' },
  { key: 'inactive', label: 'Inactive' },
]

/** A4 sort menu. */
export const SORTS = [
  { key: 'last_sign_in', label: 'Last sign-in', short: 'Last sign-in' },
  { key: 'name', label: 'Name (A–Z)', short: 'Name' },
  { key: 'role', label: 'Role (Super Admins first)', short: 'Role' },
  { key: 'attention', label: 'Needs attention first', short: 'Needs attention' },
  { key: 'created', label: 'Date created', short: 'Date created' },
]

/** Role pill: Super Admin = amber, Admin = indigo. */
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

/** The "Two-step" column: ✓ On (green) / Required (amber) / Off / Not set up (grey text). */
export function twoFactorLook(status) {
  return (
    {
      on: { pill: 'success', text: '✓ On' },
      required: { pill: 'warning', text: 'Required' },
      off: { pill: null, text: 'Off' },
      not_set_up: { pill: null, text: 'Not set up' },
    }[status] ?? { pill: null, text: status }
  )
}

/** "Now" (you) / "5 min ago" / "2 h ago" / "Yesterday" / "Nov 9, 2026" / "Never" */
export function lastSignInText(account) {
  if (account.is_you) return 'Now'
  if (!account.last_login_at) return 'Never'
  const date = new Date(account.last_login_at)
  if (isToday(date)) return formatTimeAgo(date)
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

/** "Jan 5, 2026" */
export function dateText(value) {
  return value ? format(new Date(value), 'MMM d, yyyy') : '—'
}

/** "expires in 5 days (Nov 24)" / "expires today" / "expired Nov 20" */
export function invitationExpiryText(value) {
  if (!value) return 'no link sent'
  const date = new Date(value)
  const days = differenceInCalendarDays(date, new Date())
  if (date < new Date()) return `link expired ${format(date, 'MMM d')}`
  if (days === 0) return 'link expires today'
  return `link expires in ${plural(days, 'day', 'days')} (${format(date, 'MMM d')})`
}

/** "74 days ago" / "today" */
export function daysAgoText(value) {
  if (!value) return null
  const days = differenceInCalendarDays(new Date(), new Date(value))
  return days === 0 ? 'today' : `${plural(days, 'day', 'days')} ago`
}

/** The email name part: "john.doe@Administrator.com" → "john.doe" */
export function emailName(email) {
  return (email ?? '').split('@')[0]
}

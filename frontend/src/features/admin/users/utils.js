import { format, isToday, isYesterday } from 'date-fns'
import { ROLE_EMAIL_DOMAINS } from '@/lib/constants'
import { formatTimeAgo } from '@/lib/formatters'

/** Other screens (e.g. the dashboard, the Users page) listen for this event to refresh. */
export const USERS_CHANGED_EVENT = 'advms:users-changed'

/** Add this to the current address to open the Create user modal from anywhere. */
export const CREATE_USER_SEARCH = '?create=user'

export function announceUsersChanged() {
  window.dispatchEvent(new CustomEvent(USERS_CHANGED_EVENT))
}

/** The segmented views on the Users page (`count` = the key in meta.views). */
export const VIEWS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'active', label: 'Active', count: 'active' },
  { key: 'pending', label: 'Never signed in', count: 'pending', tone: 'warning' },
  { key: 'inactive', label: 'Deactivated', count: 'inactive' },
]

export const SORTS = [
  { key: 'name', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'last_sign_in', label: 'Last sign-in' },
  { key: 'newest', label: 'Newest first' },
]

/** The status pill: active (green) / pending = never signed in (amber) / inactive = deactivated (grey). */
export function statusPill(status) {
  return (
    {
      active: { tone: 'success', text: 'Active' },
      pending: { tone: 'warning', text: 'Never signed in' },
      inactive: { tone: 'neutral', text: 'Deactivated' },
    }[status] ?? { tone: 'neutral', text: status }
  )
}

/** "5 min ago" / "Yesterday" / "Nov 9, 2026" / "Never" */
export function lastSignInText(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (isToday(date)) return formatTimeAgo(date)
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

/** The email a role change will give: "marialopez@Clerk.com" + officer → "marialopez@Officer.com". */
export function emailForRole(email, role) {
  const name = (email ?? '').split('@')[0]
  const domain = ROLE_EMAIL_DOMAINS[role]
  return name && domain ? `${name}@${domain}` : email
}

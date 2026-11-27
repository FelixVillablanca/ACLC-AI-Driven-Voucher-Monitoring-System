import { differenceInCalendarDays, differenceInMinutes, format, isToday, isYesterday } from 'date-fns'
import {
  ArrowLeftRight,
  Building2,
  CircleAlert,
  CircleCheck,
  CircleX,
  DatabaseBackup,
  Clock,
  FileText,
  Layers,
  LifeBuoy,
  Plus,
  ShieldAlert,
  Sparkles,
  Undo2,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'

/** How each notification TYPE looks while UNREAD (coloured circle + icon). */
const TYPE_STYLE = {
  security_alert: { tone: 'danger', icon: TriangleAlert },
  access_changed: { tone: 'primary', icon: ArrowLeftRight },
  user_changed: { tone: 'success', icon: Plus },
  department_alert: { tone: 'warning', icon: CircleAlert },
  company_changed: { tone: 'primary', icon: Building2 },
  voucher_approved: { tone: 'success', icon: CircleCheck },
  voucher_rejected: { tone: 'danger', icon: CircleX },
  voucher_pending: { tone: 'warning', icon: Clock },
  voucher_returned: { tone: 'danger', icon: Undo2 }, // a reviewer sent the clerk's voucher back
  draft_expiry: { tone: 'warning', icon: Clock }, // "A draft will be deleted on Dec 2" (clerks)
  anomaly_flagged: { tone: 'warning', icon: Sparkles },
  budget_alert: { tone: 'warning', icon: Wallet },
  system_alert: { tone: 'primary', icon: DatabaseBackup }, // backups (Super Admins)
  support_request: { tone: 'primary', icon: LifeBuoy }, // a clerk's "Contact support" message (Admins)
}

/** Each CATEGORY's label ("2 min ago · Security") and its icon once READ (grey circle). */
/** Fired after notifications are marked read on the All notifications page, so the bell's number updates. */
export const NOTIFICATIONS_CHANGED_EVENT = 'advms:notifications-changed'

/**
 * Where a click on a notification goes: its type's page first (e.g. draft reminders → Drafts, since the
 * draft may be gone), then its voucher (when the role's links have `voucher`), then its category's page.
 * null = nowhere (it's just marked read).
 */
export function notificationTarget(links, item) {
  if (!links) return null
  if (links.types?.[item.type]) return links.types[item.type]
  if (item.voucher_id && links.voucher) return links.voucher(item.voucher_id)
  return links.categories?.[item.category] ?? null
}

export const CATEGORIES = {
  security: { label: 'Security', icon: ShieldAlert },
  access: { label: 'Access', icon: ArrowLeftRight },
  users: { label: 'Users', icon: Users },
  departments: { label: 'Departments', icon: Layers },
  companies: { label: 'Companies', icon: Building2 },
  vouchers: { label: 'Vouchers', icon: FileText },
  ai: { label: 'AI', icon: Sparkles },
  budgets: { label: 'Budgets', icon: Wallet },
  system: { label: 'System', icon: DatabaseBackup },
  support: { label: 'Support', icon: LifeBuoy },
}

export const TONE_CLASSES = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  primary: 'bg-primary-soft text-primary',
  muted: 'bg-muted text-muted-foreground',
}

/** Icon + colours for one notification (unread = coloured, read = grey). */
export function notificationLook(item) {
  if (!item.is_read) return TYPE_STYLE[item.type] ?? { tone: 'primary', icon: CircleAlert }
  return { tone: 'muted', icon: CATEGORIES[item.category]?.icon ?? CircleAlert }
}

/** "Just now" · "2 min ago" · "1 hr ago" · "Yesterday, 4:30 PM" · "2 days ago" · "Nov 3" */
export function notificationTime(value, now = new Date()) {
  const date = new Date(value)
  const minutes = differenceInMinutes(now, date)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (isToday(date)) return `${Math.floor(minutes / 60)} hr ago`
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  const days = differenceInCalendarDays(now, date)
  if (days < 7) return `${days} days ago`
  return format(date, 'MMM d')
}

/** Splits the list into the "Today" and "Earlier" groups (empty groups are dropped). */
export function groupByDay(items) {
  const today = items.filter((item) => isToday(new Date(item.created_at)))
  const earlier = items.filter((item) => !isToday(new Date(item.created_at)))
  return [
    { label: 'Today', items: today },
    { label: 'Earlier', items: earlier },
  ].filter((group) => group.items.length > 0)
}

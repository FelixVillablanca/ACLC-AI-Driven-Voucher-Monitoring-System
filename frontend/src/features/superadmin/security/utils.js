import { differenceInSeconds, format, isToday, isYesterday } from 'date-fns'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatTimeAgo, plural } from '@/lib/formatters'

/*
 * The API sends plain facts ({ type: 'failed_sign_ins', event_count: 5, … }).
 * Everything the Security alerts panel SAYS is decided here, in one file.
 */

/** Opens the panel on top of ANY Super Admin page (like ?create=admin for the Add admin modal). */
export const SECURITY_PANEL_PARAM = 'panel'
export const SECURITY_PANEL_VALUE = 'security-alerts'
export const SECURITY_ALERT_PARAM = 'alert'
export const SECURITY_ALERTS_SEARCH = `?${SECURITY_PANEL_PARAM}=${SECURITY_PANEL_VALUE}`

/** Fired after an alert or an account changes, so the dashboard refreshes its "Needs your attention". */
export const SECURITY_ALERTS_CHANGED_EVENT = 'advms:security-alerts-changed'

export const TABS = [
  { key: 'all', label: 'All', status: undefined },
  { key: 'open', label: 'Not reviewed', status: 'open' },
  { key: 'closed', label: 'Reviewed', status: 'closed' },
]

const SEVERITY = { high: 'High', medium: 'Medium', low: 'Low' }
const OPEN_TONES = { high: 'danger', medium: 'warning', low: 'primary' }

/** The coloured pill: "High · Not reviewed" (red), "Low · Reviewed" (green), "Medium · Dismissed" (grey). */
export function alertPill(alert) {
  const level = SEVERITY[alert.severity] ?? alert.severity
  if (alert.status === 'reviewed') return { tone: 'success', text: `${level} · Reviewed` }
  if (alert.status === 'dismissed') return { tone: 'neutral', text: `${level} · Dismissed` }
  return { tone: OPEN_TONES[alert.severity] ?? 'primary', text: `${level} · Not reviewed` }
}

/** "5 failed sign-ins in 2 minutes" / "Sign-in from a new device" / "Admin password was changed" */
export function alertTitle(alert) {
  switch (alert.type) {
    case 'failed_sign_ins':
      return `${plural(alert.event_count, 'failed sign-in', 'failed sign-ins')} ${spanText(alert.first_seen_at, alert.last_seen_at)}`
    case 'new_device_sign_in':
      return 'Sign-in from a new device'
    case 'password_changed': {
      const role = ROLE_SHORT_LABELS[alert.account?.role]
      return role ? `${role} password was changed` : 'Password was changed'
    }
    case 'super_admin_added':
      return 'New Super Admin added'
    default:
      return 'Security alert'
  }
}

/** Short name for the dashboard's "Needs your attention" row ("Latest: Failed sign-ins · john@…"). */
export function alertShortName(type) {
  return (
    {
      failed_sign_ins: 'Failed sign-ins',
      new_device_sign_in: 'Sign-in from a new device',
      password_changed: 'Password changed',
      super_admin_added: 'New Super Admin added',
    }[type] ?? 'Security alert'
  )
}

/** The grey line under the title: who, from where, and (once closed) who reviewed it. */
export function alertCaption(alert) {
  const parts = [alert.subject_email]
  if (alert.status !== 'open') {
    const verb = alert.status === 'dismissed' ? 'dismissed' : 'reviewed'
    parts.push(alert.reviewed_by ? `${verb} by ${alert.reviewed_by.full_name}` : verb)
    return parts.join(' · ')
  }
  if (alert.ip_address) parts.push(`IP ${alert.ip_address}`)
  if (alert.device) parts.push(alert.device)
  return parts.join(' · ')
}

/** "12 min ago" / "3 h ago" / "Yesterday" / "Nov 10" (capital first letter, as in the design). */
export function alertWhen(alert) {
  const text = formatTimeAgo(alert.last_seen_at ?? alert.created_at) ?? ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "in 2 minutes" / "in under a minute" / "in 1 hour" */
function spanText(first, last) {
  if (!first || !last) return ''
  const seconds = Math.max(0, differenceInSeconds(new Date(last), new Date(first)))
  if (seconds < 60) return 'in under a minute'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `in ${plural(minutes, 'minute', 'minutes')}`
  return `in ${plural(Math.round(minutes / 60), 'hour', 'hours')}`
}

/** "today at 09:41" / "yesterday at 16:02" / "on Nov 10 at 08:15" */
export function dayAndTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const day = isToday(date) ? 'today' : isYesterday(date) ? 'yesterday' : `on ${format(date, 'MMM d')}`
  return `${day} at ${format(date, 'HH:mm')}`
}

/** "Detected today at 09:41 · rule: 5 or more failures in 5 minutes" */
export function detectedLine(alert) {
  const when = `Detected ${dayAndTime(alert.first_seen_at ?? alert.created_at)}`
  return alert.rule ? `${when} · rule: ${alert.rule.failures} or more failures in ${alert.rule.minutes} minutes` : when
}

const REASONS = { wrong_password: 'Wrong password', unknown_email: 'No account with this email' }

/**
 * The "What happened" rows: [{ key, time, text, where }].
 * Failed sign-ins have a list of attempts; the other alerts are one moment.
 */
export function timelineRows(alert) {
  const where = (ip, device) => [ip, device].filter(Boolean).join(' · ')

  if (alert.type === 'failed_sign_ins' && alert.events?.length) {
    return alert.events.map((event, i) => ({
      key: `${event.at}-${i}`,
      time: format(new Date(event.at), 'HH:mm:ss'),
      text: REASONS[event.reason] ?? 'Sign-in failed',
      where: where(event.ip, event.device),
    }))
  }

  const text = {
    new_device_sign_in: 'Signed in successfully',
    password_changed: 'Chose a new password with a reset link',
    super_admin_added: 'Made a Super Admin from the server console',
  }[alert.type]

  return [
    {
      key: 'only',
      time: format(new Date(alert.first_seen_at ?? alert.created_at), 'HH:mm:ss'),
      text: text ?? 'Something happened',
      where: where(alert.ip_address, alert.device),
    },
  ]
}

/** "Suggested next step" (only while the alert is open). */
export function suggestedStep(alert) {
  const account = alert.account
  const name = account?.first_name ?? 'them'

  switch (alert.type) {
    case 'failed_sign_ins':
      if (!account) return 'No account uses this email, so someone may be guessing addresses. Watch the audit log for more tries from this IP.'
      if (account.role === 'super_admin') return `This is a Super Admin account. Ask ${name} if it was them.`
      if (account.role !== 'admin') return 'This is a company user. Let their company’s Admin know.'
      if (alert.ip_seen_before === true)
        return `${name} has signed in from this IP before, so they may have forgotten their password. Check with them, and reset the password if it wasn’t them.`
      return `The IP is new for this admin. Lock the account until ${name} confirms it was them, or reset their password.`
    case 'new_device_sign_in':
      return `Ask ${name} if they signed in with ${alert.device ?? 'this device'}${alert.ip_seen_before === false ? ' (the IP is new too)' : ''}. If not, lock the account and reset the password.`
    case 'password_changed':
      return `If ${name} didn’t choose a new password, lock the account right away.`
    case 'super_admin_added':
      return 'Make sure this person should have full access to the whole platform.'
    default:
      return null
  }
}

const ACCOUNT_STATUS = {
  active: { tone: 'success', text: 'Active' },
  locked: { tone: 'danger', text: 'Locked' },
  pending: { tone: 'warning', text: 'Pending' },
}

export function accountPill(status) {
  return ACCOUNT_STATUS[status] ?? { tone: 'neutral', text: status }
}

/** "Last good sign-in: today 08:02 · Chrome on Windows" */
export function lastSignInText(account) {
  const last = account.last_good_sign_in
  if (!last) return 'No successful sign-in yet'
  return ['Last good sign-in: ' + dayAndTime(last.at).replace(' at ', ' '), last.device].filter(Boolean).join(' · ')
}

/** Tell the rest of the app (the dashboard) that alerts changed. */
export function announceAlertsChanged() {
  window.dispatchEvent(new CustomEvent(SECURITY_ALERTS_CHANGED_EVENT))
}

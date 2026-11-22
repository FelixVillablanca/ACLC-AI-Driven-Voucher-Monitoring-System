import { addDays, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'

/** Fired after a block / unblock so the banner and table refresh. */
export const AUDIT_CHANGED_EVENT = 'advms:audit-changed'
export const announceAuditChanged = () => window.dispatchEvent(new CustomEvent(AUDIT_CHANGED_EVENT))

const iso = (d) => format(d, 'yyyy-MM-dd')

/** AL5 presets → { from, to } (whole days; to = null means "up to now"). */
export const DATE_PRESETS = [
  { key: 'today', label: 'Today', range: () => ({ from: iso(new Date()), to: null }) },
  { key: 'yesterday', label: 'Yesterday', range: () => ({ from: iso(addDays(new Date(), -1)), to: iso(addDays(new Date(), -1)) }) },
  { key: '7d', label: 'Last 7 days', range: () => ({ from: iso(addDays(new Date(), -7)), to: null }) },
  { key: '30d', label: 'Last 30 days', range: () => ({ from: iso(addDays(new Date(), -30)), to: null }) },
  { key: 'month', label: 'This month', range: () => ({ from: iso(startOfMonth(new Date())), to: null }) },
  {
    key: 'last_month',
    label: 'Last month',
    range: () => ({ from: iso(startOfMonth(subMonths(new Date(), 1))), to: iso(endOfMonth(subMonths(new Date(), 1))) }),
  },
]

/** Which preset a range is, if any ('today', '7d', …) */
export function presetOf({ from, to }) {
  return DATE_PRESETS.find((p) => {
    const r = p.range()
    return r.from === from && (r.to ?? null) === (to ?? null)
  })?.key
}

/** "Today" / "Last 7 days" / "Nov 12 – Nov 19" */
export function rangeLabel(range) {
  const preset = presetOf(range)
  if (preset) return DATE_PRESETS.find((p) => p.key === preset).label
  const from = parseISO(range.from)
  const to = range.to ? parseISO(range.to) : new Date()
  return `${format(from, 'MMM d')} – ${format(to, 'MMM d')}`
}

/** "8 days" for a range (including both ends). */
export function rangeDays({ from, to }) {
  return differenceInCalendarDays(to ? parseISO(to) : new Date(), parseISO(from)) + 1
}

/** Action pill colours (the server sends the tone). */
export const TONE_PILL = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'border bg-muted text-muted-foreground',
}

/** Does the search box hold an IP address? (AL2 shows the IP banner then) */
export const looksLikeIp = (text) => /^(\d{1,3}\.){3}\d{1,3}$/.test(text ?? '') || /^[0-9a-f:]{3,}:[0-9a-f:]*$/i.test(text ?? '')

/** The filters kept in the address (?q=…&company=3&company=platform&action=login&from=…&to=…&sensitive=1&page=2). */
export function readFilters(params) {
  return {
    search: params.get('q') ?? '',
    companies: params.getAll('company'),
    actions: params.getAll('action'),
    from: params.get('from') ?? iso(new Date()),
    to: params.get('to'),
    sensitive: params.get('sensitive') === '1',
  }
}

export function writeFilters(params, changes) {
  const map = { search: 'q', companies: 'company', actions: 'action', from: 'from', to: 'to', sensitive: 'sensitive' }
  Object.entries(changes).forEach(([key, value]) => {
    const name = map[key]
    params.delete(name)
    if (Array.isArray(value)) value.forEach((v) => params.append(name, v))
    else if (value === true) params.set(name, '1')
    else if (value) params.set(name, value)
  })
  if (changes.from === iso(new Date()) && !changes.to) params.delete('from') // "today" is the default
  params.delete('page')
  return params
}

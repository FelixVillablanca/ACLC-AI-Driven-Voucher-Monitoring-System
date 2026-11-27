import { PATHS } from '@/lib/constants'

/** Fired after a Supervisor decision: the queue, the sidebar counts and an open review reload. */
export const DECISIONS_CHANGED_EVENT = 'advms:level2-changed'

export const announceDecisionsChanged = () => window.dispatchEvent(new CustomEvent(DECISIONS_CHANGED_EVENT))

export const level2Path = (id) => `${PATHS.SUPERVISOR_VOUCHERS}/${id}`

export const level2FlagPath = (id) => `${PATHS.SUPERVISOR_FLAGGED}/${id}`

/** The Level 2 queue tabs (Framer RRXP4iCfd; "Escalated" isn't built: officers can't escalate by hand). */
export const LEVEL2_VIEWS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'ai_flagged', label: 'Flagged', count: 'ai_flagged', tone: 'danger' },
  { key: 'high_value', label: 'High value', count: 'high_value' },
]

export const LEVEL2_SORTS = [
  { key: 'oldest', label: 'Oldest first' },
  { key: 'newest', label: 'Newest first' },
  { key: 'amount_desc', label: 'Amount: high to low' },
  { key: 'amount_asc', label: 'Amount: low to high' },
]

/** "Today", "1 day", "3 days" since a date (calendar days). */
export function daysWaiting(since, now = new Date()) {
  if (!since) return '—'
  const start = new Date(since)
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(start)) / 86_400_000)
  if (days <= 0) return 'Today'
  return days === 1 ? '1 day' : `${days} days`
}

/** "Maria Santos" → "Maria S." */
export function shortName(name) {
  if (!name) return '—'
  const [first, ...rest] = name.trim().split(/\s+/)
  return rest.length ? `${first} ${rest.at(-1)[0]}.` : first
}

/** Why a voucher needs Level 2, as the frame's "Required:" line. */
export function step2Text(reasons = [], threshold) {
  const parts = []
  if (reasons.includes('ai_flagged')) parts.push('flagged by the automatic check')
  if (reasons.includes('high_value')) parts.push(`at or over ${threshold ?? 'the high-value amount'}`)
  return parts.length ? parts.join(' and ') : 'forwarded by Accounting'
}

/** Shared by the Level 2 pages (Final review, Investigate flag). */
export const outlineBtn =
  'text-body-strong flex h-[38px] items-center justify-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
export const primaryBtn =
  'text-auth-button flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

export const STATUS = {
  under_review: { tone: 'primary', label: 'Under review · Level 2' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Rejected' },
  returned: { tone: 'warning', label: 'Returned to the clerk' },
  pending: { tone: 'warning', label: 'Back with Accounting' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}

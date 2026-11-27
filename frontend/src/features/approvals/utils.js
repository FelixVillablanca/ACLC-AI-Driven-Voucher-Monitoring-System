import { PATHS } from '@/lib/constants'

/** Fired after an officer decision: the queue, the sidebar counts and an open review reload. */
export const REVIEWS_CHANGED_EVENT = 'advms:reviews-changed'

export function announceReviewsChanged() {
  window.dispatchEvent(new CustomEvent(REVIEWS_CHANGED_EVENT))
}

export const reviewPath = (id) => `${PATHS.OFFICER_VOUCHERS}/${id}`

/** The queue tabs (Framer vZeEe5_Hq); `count` = the key in meta.counts. */
export const QUEUE_VIEWS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'ai_flagged', label: 'Flagged', count: 'ai_flagged', tone: 'danger' },
  { key: 'high_value', label: 'High value', count: 'high_value' },
  { key: 'near_sla', label: 'Near SLA', count: 'near_sla', tone: 'warning' },
  { key: 'resubmitted', label: 'Resubmitted', count: 'resubmitted' },
]

export const QUEUE_SORTS = [
  { key: 'oldest', label: 'Oldest' },
  { key: 'newest', label: 'Newest' },
  { key: 'amount_desc', label: 'Amount: high to low' },
  { key: 'amount_asc', label: 'Amount: low to high' },
]

/** "20 h", "1 d", "3 d" since a date (how long a voucher has waited). */
export function waitedText(since, now = new Date()) {
  if (!since) return '—'
  const hours = Math.max(0, (now - new Date(since)) / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 24) return `${Math.floor(hours)} h`
  return `${Math.floor(hours / 24)} d`
}

export const STEP2_REASON_TEXT = {
  high_value: 'the total is at or above the high-value amount',
  ai_flagged: 'it is flagged by the automatic check',
}

/** "Ana Reyes" / "Ana Reyes or Ben Cruz" / "the Supervisors" (nobody yet → a warning is shown instead). */
export function supervisorNames(names = []) {
  if (names.length === 0) return 'a Supervisor / Manager'
  if (names.length <= 2) return names.join(' or ')
  return `${names[0]} or another Supervisor`
}

export const flaggedPath = (id) => `${PATHS.OFFICER_FLAGGED}/${id}`

/** Score → level, like the frame: ≥ 0.80 high · ≥ 0.65 medium · otherwise low. */
export function scoreLevel(score) {
  const n = Number(score)
  return n >= 0.8 ? 'high' : n >= 0.65 ? 'medium' : 'low'
}

/** Who flagged it, in words: the rule-based automatic check now, the AI model from Phase 5. */
export const flagSourceText = (source) => (source === 'model' ? 'AI model' : 'Automatic check')

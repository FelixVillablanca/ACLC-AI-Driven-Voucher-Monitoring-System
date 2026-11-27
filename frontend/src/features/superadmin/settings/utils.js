import { formatMoney, formatUsd } from '@/lib/formatters'

/** The setting keys (the same strings as SystemSettings on the server). */
export const KEYS = Object.freeze({
  THRESHOLD: 'approval.high_value_threshold',
  AI_FLAGGED_STEP2: 'approval.ai_flagged_needs_step2',
  REVIEW_SLA: 'approval.review_sla_hours',
  BUDGET_SIGNOFF: 'budget.change_signoff_above',
  SENSITIVITY: 'ai.anomaly_sensitivity',
  MIN_CONFIDENCE: 'ai.category_min_confidence',
  OPENAI_CAP: 'openai.monthly_cap_usd',
  OPENAI_PAUSE: 'openai.pause_at_cap',
  IDLE_TIMEOUT: 'security.super_admin_idle_timeout_minutes',
  FAILED_SIGN_INS: 'security.failed_sign_in_alert_after',
  TWO_FACTOR_ADMINS: 'security.require_two_factor_for_admins',
})

/** The left-hand section list (amber dot = unsaved edits in that section). */
export const SECTIONS = [
  { key: 'approval', label: 'Approval rules' },
  { key: 'ai', label: 'AI & anomaly detection' },
  { key: 'openai', label: 'OpenAI usage' },
  { key: 'security', label: 'Security & sessions' },
  { key: 'backups', label: 'Data & backups' },
]

/** Change history filter tabs (G1) + the tag colour of each section. */
export const GROUP_TAGS = {
  approval: { label: 'Approval', tone: 'success' },
  ai: { label: 'AI', tone: 'warning' },
  openai: { label: 'OpenAI', tone: 'primary' },
  security: { label: 'Security', tone: 'danger' },
}

export const SENSITIVITIES = [
  // No made-up flag rates: there's no anomaly model yet, so there's no real rate to show.
  { key: 'relaxed', label: 'Relaxed', hint: 'Fewer flags: only vouchers that are far from normal (score 0.70 or more).' },
  { key: 'balanced', label: 'Balanced', hint: 'The recommended middle ground (score 0.60 or more).' },
  {
    key: 'strict',
    label: 'Strict',
    hint: 'More flags: smaller differences are flagged too (score 0.45 or more), so Supervisors see more.',
  },
]

export const IDLE_MINUTES = [5, 10, 15, 30, 60]
export const FAILED_SIGN_IN_LIMITS = [3, 5, 10]
export const REVIEW_SLA_HOURS = [24, 48, 72, 96]

const onOff = (v) => (v ? 'On' : 'Off')

/** Each setting: which section, its name, and how a value reads ("₱50,000.00", "Strict", "On"). */
export const SETTINGS = {
  [KEYS.THRESHOLD]: { group: 'approval', label: 'High-value threshold', show: (v) => formatMoney(v) },
  [KEYS.AI_FLAGGED_STEP2]: { group: 'approval', label: 'Send AI-flagged vouchers to step 2', show: onOff },
  [KEYS.REVIEW_SLA]: { group: 'approval', label: 'Review within', show: (v) => `${v} hours` },
  [KEYS.BUDGET_SIGNOFF]: { group: 'approval', label: 'Budget changes need sign-off above', show: (v) => formatMoney(v) },
  [KEYS.SENSITIVITY]: {
    group: 'ai',
    label: 'Anomaly sensitivity',
    show: (v) => SENSITIVITIES.find((s) => s.key === v)?.label ?? v,
  },
  [KEYS.MIN_CONFIDENCE]: { group: 'ai', label: 'Show category suggestions from', show: (v) => `${v}%` },
  [KEYS.OPENAI_CAP]: { group: 'openai', label: 'Monthly spend cap', show: (v) => formatUsd(v) },
  [KEYS.OPENAI_PAUSE]: { group: 'openai', label: 'Pause summaries at the cap', show: onOff },
  [KEYS.IDLE_TIMEOUT]: { group: 'security', label: 'Super Admin idle sign-out', show: (v) => `${v} minutes` },
  [KEYS.FAILED_SIGN_INS]: { group: 'security', label: 'Security alert after failed sign-ins', show: (v) => `${v} attempts` },
  [KEYS.TWO_FACTOR_ADMINS]: { group: 'security', label: 'Require two-step for admins', show: onOff },
}

export const showValue = (key, value) => (value == null ? 'Not set' : (SETTINGS[key]?.show(value) ?? String(value)))
export const settingLabel = (key) => SETTINGS[key]?.label ?? key

const MONEY = new Set([KEYS.THRESHOLD, KEYS.BUDGET_SIGNOFF, KEYS.OPENAI_CAP])

/**
 * A money box's text → the stored form "50000.00", or null when it isn't a valid amount.
 * Done on the text (never through a float) so ₱0.10 + ₱0.20 problems can't happen.
 */
export function normalizeMoney(text) {
  const clean = String(text ?? '').replace(/[,\s₱$]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [whole, cents = ''] = clean.split('.')
  return `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}`
}

/** The value the server would store for what's typed / picked (money boxes hold text). */
export function storedForm(key, value) {
  return MONEY.has(key) ? normalizeMoney(value) : value
}

/** The settings whose draft differs from the saved value: [{ key, from, to }] in screen order. */
export function pendingChanges(saved, draft) {
  return Object.keys(SETTINGS)
    .filter((key) => key in draft)
    .map((key) => ({ key, from: saved[key], to: storedForm(key, draft[key]) }))
    .filter((c) => c.to !== null && c.to !== c.from)
}

/** A money box with something that isn't an amount: { key: message } */
export function draftErrors(draft) {
  const errors = {}
  if (KEYS.THRESHOLD in draft) {
    const v = normalizeMoney(draft[KEYS.THRESHOLD])
    if (v === null) errors[KEYS.THRESHOLD] = 'Type an amount like 50,000.00'
    else if (Number(v) < 1) errors[KEYS.THRESHOLD] = 'It must be at least ₱1.00'
  }
  if (KEYS.BUDGET_SIGNOFF in draft && normalizeMoney(draft[KEYS.BUDGET_SIGNOFF]) === null) {
    errors[KEYS.BUDGET_SIGNOFF] = 'Type an amount like 250,000.00'
  }
  if (KEYS.OPENAI_CAP in draft) {
    const v = normalizeMoney(draft[KEYS.OPENAI_CAP])
    if (v === null) errors[KEYS.OPENAI_CAP] = 'Type an amount like 25.00'
    else if (Number(v) > 1000) errors[KEYS.OPENAI_CAP] = 'The cap can be at most $1,000.00'
  }
  return errors
}

const rank = (v) => SENSITIVITIES.findIndex((s) => s.key === v)

/** What a change means in plain words (the G3 "What's changing" list). */
export function impactText({ key, from, to }) {
  switch (key) {
    case KEYS.THRESHOLD:
      return Number(to) > Number(from)
        ? `Vouchers from ${formatMoney(from)} up to just under ${formatMoney(to)} will only need step 1 (Accounting Officer). It applies to every voucher Accounting approves from now on, including ones already waiting.`
        : `Vouchers from ${formatMoney(to)} and up will also need step 2 (Supervisor / Manager). It applies to every voucher Accounting approves from now on, including ones already waiting.`
    case KEYS.BUDGET_SIGNOFF:
      return `Accounting Officers' budget edits bigger than ${formatMoney(to)} will wait for a Supervisor / Manager's sign-off; smaller ones apply at once.`
    case KEYS.AI_FLAGGED_STEP2:
      return to
        ? 'Every voucher the AI flags will need the Supervisor / Manager, whatever the amount.'
        : 'AI-flagged vouchers below the high-value threshold will only need step 1.'
    case KEYS.REVIEW_SLA:
      return `Accounting Officers see a ⏱ warning once a voucher has waited ${Math.round(to * 0.75)} hours, and "past" after ${to} hours. It never blocks anything.`
    case KEYS.SENSITIVITY:
      return rank(to) > rank(from)
        ? 'More vouchers will be flagged, and each flagged one goes to step 2.'
        : 'Fewer vouchers will be flagged.'

    case KEYS.MIN_CONFIDENCE:
      return to > from
        ? 'Clerks will see fewer, but surer, category suggestions.'
        : 'Clerks will see more category suggestions, some of them less sure.'
    case KEYS.OPENAI_CAP:
      return `OpenAI report summaries may cost up to ${formatUsd(to)} a month.`
    case KEYS.OPENAI_PAUSE:
      return to
        ? 'At the cap, reports still build, just without the AI summary.'
        : 'At the cap, summaries keep going and you get an alert (spend can go over the cap).'
    case KEYS.IDLE_TIMEOUT:
      return `Super Admins are signed out after ${to} minutes without activity.`
    case KEYS.FAILED_SIGN_INS:
      return `${to} failed sign-ins for one account within 5 minutes will raise a High security alert.`
    case KEYS.TWO_FACTOR_ADMINS:
      return to
        ? 'Every Admin without two-step gets 3 days to set it up (we email them the steps). New Admins set it up at their first sign-in.'
        : 'New Admins won’t have to set up two-step. Admins already asked still have to.'
    default:
      return null
  }
}

/** Changes that mean LESS checking: the G3 amber "make sure Finance agrees" note. */
export function lowersChecks({ key, from, to }) {
  if (key === KEYS.THRESHOLD) return Number(to) > Number(from)
  if (key === KEYS.AI_FLAGGED_STEP2) return from === true && to === false
  if (key === KEYS.SENSITIVITY) return rank(to) < rank(from)
  if (key === KEYS.TWO_FACTOR_ADMINS) return from === true && to === false
  if (key === KEYS.OPENAI_PAUSE) return from === true && to === false
  return false
}

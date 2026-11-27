import { REVIEWS_CHANGED_EVENT } from '@/features/approvals'
import { PATHS } from '@/lib/constants'

/** Fired after a budget is allocated / changed / a request cancelled: pages reload, the sidebar's alert count too. */
export const BUDGETS_CHANGED_EVENT = 'budgets:changed'

export function announceBudgetsChanged() {
  window.dispatchEvent(new Event(BUDGETS_CHANGED_EVENT))
  window.dispatchEvent(new Event(REVIEWS_CHANGED_EVENT)) // the officer summary (sidebar) listens to this one
}

/** /officer/budgets/12?year=2026 (the year only when it isn't the current one) */
export function budgetPath(departmentId, year, currentYear) {
  return `${PATHS.OFFICER_BUDGETS}/${departmentId}${year && year !== currentYear ? `?year=${year}` : ''}`
}

/**
 * A money box's text → "1600000.00", or null when it isn't an amount. Done on the text, never through a
 * float, so the server gets exactly what was typed.
 */
export function normalizeMoney(text) {
  const clean = String(text ?? '').replace(/[,\s₱]/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [whole, cents = ''] = clean.split('.')
  return `${whole.replace(/^0+(?=\d)/, '')}.${cents.padEnd(2, '0')}`
}

/** "1600000.00" → 160000000 (whole centavos, exact for any budget we allow) */
export function toCentavos(money) {
  const [whole, cents = ''] = String(money ?? '0').split('.')
  return Number(whole || 0) * 100 + Number(cents.padEnd(2, '0').slice(0, 2))
}

export const fromCentavos = (c) => (c / 100).toFixed(2)

/** "1500000.00" → "1,500,000.00" (what a money box shows) */
export const moneyText = (v) =>
  v == null || v === '' ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₱12.00M / ₱486k / ₱950 for the big cards (the exact amount is in the title tooltip). */
export function compactMoney(value) {
  const n = Number(value ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `₱${Math.round(n / 1_000)}k`
  return `₱${Math.round(n).toLocaleString('en-US')}`
}

/** "92%" without needless decimals (92.5 → "92.5%") */
export const pctText = (pct) => `${Number(pct ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`

/**
 * The colour of a usage number / bar (Framer: Danger at or over the alert, Warning within 15 points of it,
 * Primary from 50%, Success below).
 */
export function usageTone(pct, alertPct) {
  if (pct >= alertPct) return 'danger'
  if (pct >= alertPct - 15) return 'warning'
  if (pct >= 50) return 'primary'
  return 'success'
}

export const TONE_TEXT = { danger: 'text-danger', warning: 'text-warning', primary: 'text-primary', success: 'text-success' }
export const TONE_BAR = { danger: 'bg-danger', warning: 'bg-warning', primary: 'bg-primary', success: 'bg-success' }

/** The 4 alert levels offered (the server accepts 50–100). */
export const ALERT_MIN = 50
export const ALERT_MAX = 100

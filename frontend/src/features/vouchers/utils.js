/** Fired after a voucher is created / saved / submitted / cancelled (lists, dashboard and sidebar counts refresh). */
export const VOUCHERS_CHANGED_EVENT = 'advms:vouchers-changed'

export function announceVouchersChanged() {
  window.dispatchEvent(new CustomEvent(VOUCHERS_CHANGED_EVENT))
}

/** Status → pill (agreed flow 2026-11-22: pending = with the Accounting Officer, under_review = with the Supervisor). */
export const STATUS_PILLS = {
  draft: { tone: 'neutral', text: 'Draft' },
  pending: { tone: 'primary', text: 'With Accounting' },
  under_review: { tone: 'warning', text: 'With Supervisor' },
  returned: { tone: 'danger', text: '↩ Returned' },
  approved: { tone: 'success', text: '✓ Approved' },
  rejected: { tone: 'danger', text: 'Rejected' },
  cancelled: { tone: 'neutral', text: 'Cancelled' },
}

export const statusPill = (status) => STATUS_PILLS[status] ?? { tone: 'neutral', text: status }

/** The tabs on My vouchers (`count` = the key in meta.counts). */
export const VIEWS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'draft', label: 'Drafts', count: 'draft' },
  { key: 'in_review', label: 'In review', count: 'in_review' },
  { key: 'returned', label: 'Returned', count: 'returned', tone: 'warning' },
  { key: 'approved', label: 'Approved', count: 'approved' },
  { key: 'rejected', label: 'Rejected', count: 'rejected' },
  { key: 'cancelled', label: 'Cancelled', count: 'cancelled' },
]

export const SORTS = [
  { key: 'recent', label: 'Recently changed' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'amount_desc', label: 'Amount: high to low' },
  { key: 'amount_asc', label: 'Amount: low to high' },
]

export const PAYMENT_LABELS = { cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque' }
export const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' }

/**
 * A line total for the screen while typing, in CENTAVOS (whole numbers) so 0.1 + 0.2 problems can't
 * happen; rounded half-up like the server. The server's total is the one that's saved.
 */
export function lineCents(quantity, unitPrice) {
  const q = Math.round(Number(quantity || 0) * 100) // hundredths of a unit
  const p = Math.round(Number(unitPrice || 0) * 100) // centavos
  if (!Number.isFinite(q) || !Number.isFinite(p)) return 0
  return Math.floor((q * p + 50) / 100) // (q/100 × p) rounded half-up
}

export const centsToAmount = (cents) => (cents / 100).toFixed(2)

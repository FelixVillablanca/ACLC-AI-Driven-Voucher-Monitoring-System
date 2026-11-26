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

/** Drafts are deleted after this many days without a change (server: DraftExpiry::DAYS / WARN_DAYS). */
export const DRAFT_DAYS = 30
export const DRAFT_WARN_DAYS = 3

/** "Expires in 3 days" / "Expires tomorrow" / "Expires today"; `soon` = within the warning window. */
export function draftExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) return { soon: false, label: null }
  const days = Math.ceil((new Date(expiresAt) - now) / 86_400_000)
  const label = days <= 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`
  return { soon: days <= DRAFT_WARN_DAYS, label, days }
}

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

/** Who sent a voucher back (voucher.returned.role → label). Step 1 = Accounting Officer, step 2 = Supervisor. */
export const RETURN_ROLE_LABELS = { accounting_officer: 'Accounting', supervisor_manager: 'Supervisor / Manager' }

/** "Maria Santos · Accounting · Nov 6, 3:05 PM" parts for a voucher.returned note. */
export function returnedByText(returned) {
  if (!returned) return 'A reviewer'
  return [returned.by ?? 'A reviewer', RETURN_ROLE_LABELS[returned.role]].filter(Boolean).join(' · ')
}

/** Sorts on Returned to me (server: ClerkVouchers::SORTS). */
export const RETURNED_SORTS = [
  { key: 'returned_oldest', label: 'Oldest first' },
  { key: 'returned_recent', label: 'Newest first' },
  { key: 'amount_desc', label: 'Amount: high to low' },
  { key: 'amount_asc', label: 'Amount: low to high' },
]

/** Statuses that block a second cheque for the same voucher (same list as the server's ChequeRules::LIVE). */
export const LIVE_STATUSES = ['issued', 'released', 'cleared']

/** "Stale in 12 days" / "Goes stale today" for outstanding cheques, else null. */
export function staleHint(cheque) {
  if (cheque.days_left == null) return null
  if (cheque.days_left <= 0) return 'Goes stale today'
  return `Stale in ${cheque.days_left} ${cheque.days_left === 1 ? 'day' : 'days'}`
}

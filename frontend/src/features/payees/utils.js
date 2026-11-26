/** Fired after a payee is added / changed / (de)activated: the list and an open panel reload. */
export const PAYEES_CHANGED_EVENT = 'advms:payees-changed'

export function announcePayeesChanged() {
  window.dispatchEvent(new CustomEvent(PAYEES_CHANGED_EVENT))
}

export const PAY_VIA = { cash: 'Cash', bank: 'Bank transfer', cheque: 'Check' }

export const SORTS = [
  { key: 'most_used', label: 'Most used' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'recent', label: 'Recently used' },
  { key: 'approved_desc', label: 'Approved this year' },
]

/**
 * Payee types are the Admin's own names, so the colour follows the word (Framer: Utility amber,
 * Supplier indigo, Employee green, Government grey); anything else is indigo.
 */
export function typeTone(name = '') {
  const n = name.toLowerCase()
  if (/util/.test(n)) return 'warning'
  if (/employ|staff|personnel/.test(n)) return 'success'
  if (/gov|bir|tax|agency/.test(n)) return 'neutral'
  return 'primary'
}

/** "Meralco" → "ME", "Grab for Business" → "GB". */
export function payeeInitials(name = '') {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

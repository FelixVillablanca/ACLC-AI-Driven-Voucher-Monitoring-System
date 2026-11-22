import { FileText, Tags, UserRound } from 'lucide-react'

/** Fired after any change on the Categories page, so the page and the dashboard refresh. */
export const CATALOG_CHANGED_EVENT = 'advms:catalog-changed'

export function announceCatalogChanged() {
  window.dispatchEvent(new CustomEvent(CATALOG_CHANGED_EVENT))
}

/**
 * The 3 lists (tabs) on the Categories page (decided 2026-11-22: one page instead of 3).
 * `details` = the list has a code, a description and active / deactivated (categories only).
 */
export const KINDS = [
  {
    key: 'categories',
    tab: 'Voucher categories',
    one: 'category',
    icon: Tags,
    details: true,
    intro: 'What a voucher is for, e.g. Office supplies or Travel. The AI suggests one from the description.',
    example: 'e.g. Office supplies',
  },
  {
    key: 'voucher_types',
    tab: 'Voucher types',
    one: 'voucher type',
    icon: FileText,
    details: false,
    intro: 'The kind of voucher, e.g. Cash advance, Reimbursement or Liquidation.',
    example: 'e.g. Cash advance',
  },
  {
    key: 'payee_types',
    tab: 'Payee types',
    one: 'payee type',
    icon: UserRound,
    details: false,
    intro: 'Who gets paid, e.g. Supplier, Employee or Contractor. Clerks pick one on every voucher.',
    example: 'e.g. Supplier',
  },
]

export const kindOf = (key) => KINDS.find((k) => k.key === key) ?? KINDS[0]

/** "OFF" from "Office supplies" (only a suggestion for the category code). */
export function suggestCode(name = '') {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, 3)
  return words
    .slice(0, 4)
    .map((w) => w[0])
    .join('')
}

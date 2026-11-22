import { format } from 'date-fns'
import { formatTimeAgo } from '@/lib/formatters'

/** Fired after a company is suspended / reactivated, so the list and the dashboard refresh. */
export const COMPANIES_CHANGED_EVENT = 'advms:companies-changed'

/** Add this to the address to open "+ Add company" on the Companies tab. */
export const CREATE_COMPANY_SEARCH = '?create=company'

/** Opens Add admin with this company already chosen (the modal reads ?for=). */
export function addAdminSearch(companyId) {
  return `?create=admin&for=${companyId}`
}

export function announceCompaniesChanged() {
  window.dispatchEvent(new CustomEvent(COMPANIES_CHANGED_EVENT))
}

/** The segmented views (Framer vnNFYExpX; C5 = Suspended, amber when selected). */
export const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended', tone: 'warning' },
]

/** C3 sort menu. */
export const SORTS = [
  { key: 'name', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'users', label: 'Most users' },
  { key: 'departments', label: 'Most departments' },
  { key: 'recent', label: 'Recently active' },
  { key: 'newest', label: 'Newest first' },
]

/** companies.type → the word on the card ("Corporation · Makati City"). */
export const TYPE_LABELS = {
  school: 'School',
  corporate: 'Corporation',
  government: 'Government',
  ngo: 'NGO',
  other: 'Organisation',
}

/** "Corporation · Makati City" (the address is shown as typed; there's no separate city field). */
export function companySubtitle(company) {
  return [TYPE_LABELS[company.type] ?? company.type, company.address].filter(Boolean).join(' · ')
}

/** "Apex Holdings Inc." → "AH"  ·  "Northfield" → "NO" */
export function companyInitials(name = '') {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** The logo tile colours rotate (indigo, green, amber) so neighbouring cards look different; suspended = grey. */
const TILE_TONES = [
  'bg-primary-soft text-primary',
  'bg-success-soft text-success',
  'bg-hero-amber-soft text-warning',
]

export function tileTone(company) {
  if (company.status !== 'active') return 'bg-muted text-muted-foreground'
  return TILE_TONES[company.id % TILE_TONES.length]
}

/** The word to type in the Suspend dialog (C6): the first word of the name, in capitals ("APEX"). */
export function confirmWord(name = '') {
  return (name.trim().split(/\s+/)[0] ?? '').replace(/[^\p{L}\p{N}-]/gu, '').toUpperCase() || name.toUpperCase()
}

/** "3 min ago" / "Today" … / "No activity yet" */
export function lastActivityText(value) {
  if (!value) return 'None yet'
  const text = formatTimeAgo(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "since Jan 2026" or "added this month" */
export function sinceText(createdAt) {
  if (!createdAt) return null
  const date = new Date(createdAt)
  const now = new Date()
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return 'added this month'
  return `since ${format(date, 'MMM yyyy')}`
}

/** "Suspended yesterday by you" / "Suspended on Nov 10 by Ramon Cruz" */
export function suspendedText(suspension) {
  if (!suspension) return null
  const ago = formatTimeAgo(suspension.at)
  const when = /ago|now|yesterday/.test(ago) ? ago : `on ${ago}`
  const who = suspension.by_you ? 'you' : (suspension.by?.full_name ?? 'a Super Admin')
  return `Suspended ${when} by ${who}`
}

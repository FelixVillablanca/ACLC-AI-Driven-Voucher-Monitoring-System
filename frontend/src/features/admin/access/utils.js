/** Fired after access is granted, so the dashboard refreshes its numbers. */
export const ACCESS_CHANGED_EVENT = 'advms:access-changed'

/** Add this to the address to open "Grant company access" from anywhere in the admin area. */
export const GRANT_ACCESS_SEARCH = '?grant=access'

/** What the small pill next to a person says about their current access row. */
export const ACCESS_PILLS = {
  pending: { tone: 'warning', text: 'Waiting' },
  denied: { tone: 'danger', text: 'Refused before' },
}

export function announceAccessChanged() {
  window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT))
}

/** The segmented views on the Company access page (`count` = the key in meta.views). */
export const VIEWS = [
  { key: null, label: 'Everyone', count: 'all' },
  { key: 'has_access', label: 'Has access', count: 'has_access' },
  { key: 'no_access', label: 'No access', count: 'no_access', tone: 'warning' },
  { key: 'other_companies', label: 'From other companies', count: 'other_companies' },
]

export const SORTS = [
  { key: 'name', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'recent', label: 'Recently changed' },
]

/** The access pill for one person. */
export function accessPill(access) {
  return (
    {
      accepted: { tone: 'success', text: 'Has access' },
      pending: { tone: 'warning', text: 'Waiting' },
      denied: { tone: 'danger', text: 'Removed / refused' },
      none: { tone: 'neutral', text: 'No access' },
    }[access] ?? { tone: 'neutral', text: access }
  )
}

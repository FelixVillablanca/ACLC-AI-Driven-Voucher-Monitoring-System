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

/** Add this to the address to open "Invite from other companies". */
export const INVITE_PEOPLE_SEARCH = '?invite=people'

/**
 * The 3 tabs on the Company access page (user decision 2026-11-22: your own people and people from
 * other companies are kept apart). `count` = the key in meta.views.
 */
export const VIEWS = [
  { key: null, label: 'In your company', count: 'in_company' },
  { key: 'other_companies', label: 'From other companies', count: 'other_companies' },
  { key: 'requests', label: 'Requests', count: 'requests', tone: 'warning' },
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

/** Fired after access is granted, so the dashboard refreshes its numbers. */
export const ACCESS_CHANGED_EVENT = 'advms:access-changed'

/** Add this to the address to open "Grant company access" from anywhere in the admin area. */
export const GRANT_ACCESS_SEARCH = '?grant=access'

/** What the small pill next to a person says about their current access row. */
export const ACCESS_PILLS = {
  pending: { tone: 'warning', text: 'Waiting' },
  denied: { tone: 'danger', text: 'Refused before' },
}

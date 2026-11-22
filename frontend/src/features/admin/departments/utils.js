/** Fired after a department is added / changed / (de)activated, so the list, panel and dashboard refresh. */
export const DEPARTMENTS_CHANGED_EVENT = 'advms:departments-changed'

/** Add this to the address to open "Add department" from anywhere in the admin area. */
export const CREATE_DEPARTMENT_SEARCH = '?create=department'

export function announceDepartmentsChanged() {
  window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED_EVENT))
}

/**
 * A code suggestion from the name: "Finance" → "FIN", "Human Resources" → "HR",
 * "IT Operations Support" → "IOS". Only a suggestion: the Admin can change it.
 */
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

/** The segmented views on the Departments page (`count` = the key in meta.views). */
export const VIEWS = [
  { key: null, label: 'All', count: 'all' },
  { key: 'active', label: 'Active', count: 'active' },
  { key: 'no_head', label: 'No head', count: 'no_head', tone: 'warning' },
  { key: 'inactive', label: 'Inactive', count: 'inactive' },
]

/** The sort menu. */
export const SORTS = [
  { key: 'name', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'people', label: 'Most people' },
  { key: 'newest', label: 'Newest first' },
]

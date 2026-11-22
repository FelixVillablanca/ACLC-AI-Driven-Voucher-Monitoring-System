/** Fired after a department is added, so the dashboard refreshes its numbers. */
export const DEPARTMENTS_CHANGED_EVENT = 'advms:departments-changed'

/** Add this to the address to open "Add department" from anywhere in the admin area. */
export const CREATE_DEPARTMENT_SEARCH = '?create=department'

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

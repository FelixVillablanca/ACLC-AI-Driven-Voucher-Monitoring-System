/** Shared input/select look (Framer: 40px tall, 8px radius, Primary border on focus, Danger on error). */
export const inputClass =
  'text-body h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-[0.5px] focus:ring-primary aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'

/** Other screens (e.g. the dashboard) listen for this event to refresh their numbers. */
export const USERS_CHANGED_EVENT = 'advms:users-changed'

/** Add this to the current address to open the Create user modal from anywhere. */
export const CREATE_USER_SEARCH = '?create=user'

// No look-alike characters (0/O, 1/l/I), so it's easy to read out or type
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALPHABET = LETTERS + DIGITS

/**
 * A random sign-in password like "Kp7m-Qx2r-Tw9n": 12 letters + numbers in 3 groups.
 * crypto.getRandomValues = the browser's SECURE random generator (Math.random is
 * predictable and must never be used for passwords). Always has a letter AND a number.
 */
export function generatePassword() {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint32Array(12))
    const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length])
    const password = [0, 4, 8].map((i) => chars.slice(i, i + 4).join('')).join('-')
    if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) return password
  }
}

// Shared by every "create an account" form (admin Create user, Super Admin Create admin).

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

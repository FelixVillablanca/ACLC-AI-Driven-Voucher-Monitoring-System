import { Laptop, Monitor, Smartphone } from 'lucide-react'
import { ACCOUNT_PATHS, ROLES } from '@/lib/constants'

/** The 5 account pages for this role (Admin and Super Admin have their own addresses). */
export const accountLinks = (role) => ACCOUNT_PATHS[role] ?? ACCOUNT_PATHS[ROLES.ADMIN]

/** The tab row at the top of every account page, in the account menu's order. */
export const ACCOUNT_TABS = [
  { key: 'profile', label: 'My profile' },
  { key: 'settings', label: 'Account settings' },
  { key: 'changePassword', label: 'Change password' },
  { key: 'activity', label: 'My activity' },
  { key: 'help', label: 'Help & support' },
]

/**
 * The live checklist under "New password". The server checks the same rules
 * (ChangePasswordRequest), so the list only helps; it never decides alone.
 */
export function passwordChecks(password, { current = '', confirmation = '', user } = {}) {
  const lower = password.toLowerCase()
  const nameParts = [user?.first_name, user?.last_name, user?.email?.split('@')[0]]
    .map((p) => (p ?? '').trim().toLowerCase())
    .filter((p) => p.length >= 4)

  return [
    { key: 'length', label: 'At least 12 characters', ok: password.length >= 12 && password.length <= 64 },
    { key: 'mix', label: 'Letters and numbers', ok: /[A-Za-z]/.test(password) && /[0-9]/.test(password) },
    { key: 'name', label: 'Doesn’t contain your name or email', ok: password !== '' && !nameParts.some((p) => lower.includes(p)) },
    { key: 'new', label: 'Different from your current password', ok: password !== '' && password !== current },
    { key: 'match', label: 'Both new passwords match', ok: password !== '' && password === confirmation },
  ]
}

/**
 * A rough strength score 0–4 (length + kinds of characters). Only a hint for the bar;
 * a long phrase beats a short jumble.
 */
export function passwordStrength(password) {
  if (!password) return { score: 0, label: '' }
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

export const STRENGTH_TONES = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

/** A small picture for a signed-in browser: phone / laptop / desktop. */
export function deviceIcon(device) {
  if (!device) return Monitor
  if (/Android|iOS/.test(device)) return Smartphone
  if (/macOS|ChromeOS/.test(device)) return Laptop
  return Monitor
}

/** The coloured dot of an activity entry (tone comes from the server's AuditCatalog). */
export const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  primary: 'bg-primary',
  neutral: 'bg-muted-foreground/50',
}

/** My activity filter (?type=…): the same 3 groups the server knows. */
export const ACTIVITY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'security', label: 'Sign-in & security' },
  { key: 'changes', label: 'Changes I made' },
]

/** The account pages' buttons (38px, 8px radius, like the other app buttons). */
export const buttonClass = {
  primary:
    'text-auth-button flex h-[38px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
  secondary:
    'text-body-strong flex h-[38px] items-center justify-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
  danger:
    'text-body-strong flex h-[38px] items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-card px-3.5 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
}

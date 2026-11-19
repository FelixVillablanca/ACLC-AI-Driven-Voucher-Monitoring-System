import { format, isToday, isYesterday } from 'date-fns'

/**
 * Turning raw values into text people read, in ONE place, so every screen
 * shows numbers, money and dates the same way.
 * Intl = the browser's built-in formatter (no extra package needed).
 */
const numberFormat = new Intl.NumberFormat('en-PH')
const moneyFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

/** 1234 -> "1,234" */
export function formatNumber(value) {
  return numberFormat.format(Number(value ?? 0))
}

/** 48250 -> "₱48,250.00". The API sends money as a string (DECIMAL), never a float. */
export function formatMoney(value) {
  return moneyFormat.format(Number(value ?? 0))
}

/** Date -> "Sunday, November 8, 2026" (or any date-fns pattern) */
export function formatDate(value, pattern = 'EEEE, MMMM d, yyyy') {
  return format(value instanceof Date ? value : new Date(value), pattern)
}

/** A sign-in time, friendly: "Today, 8:42 AM" / "Yesterday, 4:12 PM" / "Nov 3, 2026, 9:05 AM" */
export function formatSignInTime(value) {
  if (!value) return null
  const date = new Date(value)
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, yyyy, h:mm a')
}

/** "FV" from { first_name: "Felix", last_name: "Villablanca" } (avatar circles) */
export function formatInitials(user) {
  return `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

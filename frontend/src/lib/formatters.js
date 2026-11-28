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

const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** "25" -> "$25.00" (OpenAI bills in US dollars, so its cap and spend are shown in $) */
export function formatUsd(value) {
  return usdFormat.format(Number(value ?? 0))
}

/** Short "how long ago": "just now" / "5 min ago" / "3 h ago" / "yesterday" / "Nov 10" */
export function formatTimeAgo(value, now = new Date()) {
  if (!value) return null
  const date = new Date(value)
  const minutes = Math.floor((now - date) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (isToday(date)) return `${Math.floor(minutes / 60)} h ago`
  if (isYesterday(date)) return 'yesterday'
  return format(date, date.getFullYear() === now.getFullYear() ? 'MMM d' : 'MMM d, yyyy')
}

/** Short "how long until": "in 40 min" / "in 5 h" / "in 2 days" / "any moment now" (past or under a minute) */
export function formatTimeLeft(value, now = new Date()) {
  if (!value) return null
  const minutes = Math.floor((new Date(value) - now) / 60000)
  if (minutes < 1) return 'any moment now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `in ${hours} h` : `in ${Math.floor(hours / 24)} days`
}

/** Which day: "today" / "yesterday" / "on Nov 10" (e.g. "Added today") */
export function formatDayAgo(value) {
  if (!value) return null
  const date = new Date(value)
  if (isToday(date)) return 'today'
  if (isYesterday(date)) return 'yesterday'
  return `on ${format(date, 'MMM d')}`
}

/** "Good morning" / "Good afternoon" / "Good evening" from the current hour (landing-page greetings). */
export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "1 company" / "3 companies" */
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

/** "FV" from { first_name: "Felix", last_name: "Villablanca" } (avatar circles) */
export function formatInitials(user) {
  return `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

/** "412 MB" / "1.2 GB" / "860 KB" */
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—'
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let value = Number(bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

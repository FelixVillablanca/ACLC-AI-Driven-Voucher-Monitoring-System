import { createCn } from 'cn/config'

/**
 * cn() joins class names AND removes clashing Tailwind classes:
 *   cn('px-2', 'px-4') -> 'px-4'   (the last one wins)
 *
 * It must be told about our own Framer text styles (css/main.css @utility text-…).
 * Otherwise it sees "text-badge" (a font SIZE) and "text-success" (a COLOUR),
 * thinks they clash, and silently drops "text-badge". That bug made the
 * dashboard pills 16px instead of 12px.
 * Add a name here whenever a new text style is added to main.css.
 */
const TEXT_STYLES = [
  'auth-heading',
  'page-title',
  'stat-value',
  'card-title',
  'body',
  'body-strong',
  'label',
  'caption',
  'table-head',
  'nav-section',
  'badge',
  'display',
  'auth-link',
  'auth-button',
  'brand-logo',
  'brand-small',
]

export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: TEXT_STYLES }] } },
})

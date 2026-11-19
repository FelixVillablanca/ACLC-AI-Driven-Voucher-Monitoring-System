import { formatDistanceToNow } from 'date-fns'
import { ArrowLeftRight, CircleAlert, Pencil, Plus } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { plural } from '@/lib/formatters'


const ENTITY_LABELS = {
  users: 'user',
  companies: 'company',
  departments: 'department',
  voucher_types: 'voucher type',
  payee_types: 'payee type',
  voucher_categories: 'category',
}

// What each audit action looks like (Framer: icon circle + coloured badge)
const ACTIONS = {
  created: { verb: 'Created', badge: 'Created', tone: 'success', icon: Plus },
  activated: { verb: 'Activated', badge: 'Activated', tone: 'success', icon: Plus },
  updated: { verb: 'Updated', badge: 'Updated', tone: 'primary', icon: Pencil },
  access_granted: { verb: 'Granted', badge: 'Access', tone: 'primary', icon: ArrowLeftRight },
  access_revoked: { verb: 'Removed', badge: 'Access removed', tone: 'warning', icon: CircleAlert },
  deactivated: { verb: 'Deactivated', badge: 'Deactivated', tone: 'warning', icon: CircleAlert },
  deleted: { verb: 'Deleted', badge: 'Deleted', tone: 'warning', icon: CircleAlert },
}

/**
 * Turns one audit-log entry from the API into what the activity row shows:
 *   { title: 'Created user Juan Dela Cruz', subtitle: 'Apex Holdings · 10 minutes ago', badge, tone, icon }
 */
export function describeActivity(item) {
  const action = ACTIONS[item.action] ?? { verb: item.action, badge: item.action, tone: 'primary', icon: Pencil }
  const entity = ENTITY_LABELS[item.entity] ?? item.entity?.replaceAll('_', ' ')
  const subject = item.subject ? (item.entity === 'voucher_types' ? `“${item.subject}”` : item.subject) : ''

  const title =
    item.action === 'access_granted'
      ? `Granted ${item.company ?? 'company'} access to ${item.subject ?? 'a user'}`
      : [action.verb, entity, subject].filter(Boolean).join(' ')

  const when = item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : null
  const subtitle = [item.action === 'access_granted' ? null : item.company, when].filter(Boolean).join(' · ')

  return { ...action, title, subtitle }
}

/** The "Needs attention" items: text + where the link goes. */
export function describeAttention(item) {
  switch (item.type) {
    case 'users_without_access':
      return {
        text: `${plural(item.count, 'user has', 'users have')} no company access`,
        link: 'Assign access',
        to: PATHS.ADMIN_COMPANY_ACCESS,
        tone: 'warning',
      }
    case 'departments_without_head':
      return {
        text: `${plural(item.count, 'department', 'departments')} without a head`,
        link: 'Review departments',
        to: PATHS.ADMIN_DEPARTMENTS,
        tone: 'warning',
      }
    case 'company_without_payee_types':
      return {
        text: `${item.company.name} has no payee types`,
        link: 'Set up payee types',
        to: PATHS.ADMIN_CATEGORIES,
        tone: 'primary',
      }
    default:
      return null
  }
}

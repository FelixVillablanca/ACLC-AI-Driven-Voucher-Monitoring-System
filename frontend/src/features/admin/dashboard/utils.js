import { formatDistanceToNow } from 'date-fns'
import { ArrowLeftRight, CircleAlert, Pencil, Plus } from 'lucide-react'
import { GRANT_ACCESS_SEARCH } from '@/features/admin/access'
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
  department_created: { verb: 'Created', badge: 'Created', tone: 'success', icon: Plus },
  catalog_created: { verb: 'Added', badge: 'Added', tone: 'success', icon: Plus },
  catalog_updated: { verb: 'Updated', badge: 'Updated', tone: 'primary', icon: Pencil },
  catalog_deleted: { verb: 'Deleted', badge: 'Deleted', tone: 'warning', icon: CircleAlert },
  catalog_deactivated: { verb: 'Deactivated', badge: 'Deactivated', tone: 'warning', icon: CircleAlert },
  catalog_reactivated: { verb: 'Reactivated', badge: 'Reactivated', tone: 'success', icon: Plus },
  department_updated: { verb: 'Updated', badge: 'Updated', tone: 'primary', icon: Pencil },
  department_deactivated: { verb: 'Deactivated', badge: 'Deactivated', tone: 'warning', icon: CircleAlert },
  department_reactivated: { verb: 'Reactivated', badge: 'Reactivated', tone: 'success', icon: Plus },
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
  const subject = item.subject ? (['voucher_types', 'payee_types', 'voucher_categories'].includes(item.entity) ? `“${item.subject}”` : item.subject) : ''

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
    case 'join_requests':
      return {
        text: `${plural(item.count, 'person asks', 'people ask')} to join your company`,
        link: 'Answer requests',
        to: `${PATHS.ADMIN_COMPANY_ACCESS}?view=requests`,
        tone: 'warning',
      }
    case 'users_without_access':
      return {
        text: `${plural(item.count, 'user has', 'users have')} no company access`,
        link: 'Assign access',
        to: { search: GRANT_ACCESS_SEARCH }, // opens the Grant company access modal
        tone: 'warning',
      }
    case 'departments_without_head':
      return {
        text: `${plural(item.count, 'department', 'departments')} without a head`,
        link: 'Review departments',
        to: `${PATHS.ADMIN_DEPARTMENTS}?view=no_head`,
        tone: 'warning',
      }
    case 'company_without_voucher_types':
      return {
        text: 'No voucher types yet',
        link: 'Add voucher types',
        to: `${PATHS.ADMIN_CATEGORIES}?tab=voucher_types`,
        tone: 'primary',
      }
    case 'company_without_categories':
      return {
        text: 'No active voucher categories',
        link: 'Add categories',
        to: PATHS.ADMIN_CATEGORIES,
        tone: 'primary',
      }
    case 'company_without_payee_types':
      return {
        text: `${item.company.name} has no payee types`,
        link: 'Set up payee types',
        to: `${PATHS.ADMIN_CATEGORIES}?tab=payee_types`,
        tone: 'primary',
      }
    default:
      return null
  }
}

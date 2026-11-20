import { Building2, Cpu, DatabaseBackup, RotateCw, ShieldAlert } from 'lucide-react'
import { alertShortName, SECURITY_ALERTS_SEARCH } from '@/features/superadmin/security'
import { PATHS } from '@/lib/constants'
import { formatDayAgo, formatTimeAgo, plural } from '@/lib/formatters'

/*
 * The API sends plain facts ({ type: 'failed_jobs', count: 2 }).
 * These helpers turn them into what the screen shows (words, colours, icons, links),
 * so all the wording for this page lives in ONE file.
 */

const SERVICE_NAMES = { ml: 'ML service', queue: 'Queue workers', scheduler: 'Scheduler', backup: 'Database backup' }

/** One Services row: { name, text, tone } */
export function describeService(service) {
  const name = SERVICE_NAMES[service.key] ?? service.key

  switch (service.key) {
    case 'ml':
      return {
        name,
        ...{
          ok: { text: 'Operational', tone: 'success' },
          danger: { text: 'Not answering', tone: 'danger' },
          not_configured: { text: 'Not set up yet', tone: 'neutral' },
        }[service.status],
      }
    case 'queue':
      return service.failed > 0
        ? { name, text: `${service.failed} failed`, tone: 'warning' }
        : { name, text: service.waiting > 0 ? `${service.waiting} waiting` : 'Running', tone: 'success' }
    case 'scheduler':
      return {
        name,
        ...{
          ok: { text: 'On schedule', tone: 'success' },
          warning: { text: 'Stopped', tone: 'warning' },
          not_configured: { text: 'Not running', tone: 'warning' },
        }[service.status],
      }
    case 'backup':
      return {
        name,
        ...{
          ok: { text: 'Up to date', tone: 'success' },
          danger: { text: 'Overdue', tone: 'danger' },
          not_configured: { text: 'None yet', tone: 'danger' },
        }[service.status],
      }
    default:
      return { name, text: service.status, tone: 'neutral' }
  }
}

const SEVERITY_TONES = { danger: 'danger', warning: 'warning', info: 'primary' }

/** One "Needs your attention" row: { title, caption, action, to, icon, tone } */
export function describeAttention(item) {
  const tone = SEVERITY_TONES[item.severity] ?? 'primary'

  switch (item.type) {
    case 'backup_missing':
      return {
        tone,
        icon: DatabaseBackup,
        title: 'Database backups aren’t set up',
        caption: 'No backup has been recorded yet · should run every 24 h',
        action: 'Open system health',
        to: PATHS.SUPERADMIN_SYSTEM_HEALTH,
      }
    case 'backup_overdue':
      return {
        tone,
        icon: DatabaseBackup,
        title: 'Database backup is overdue',
        caption: `Last backup ${formatTimeAgo(item.last_success_at)} · should run every 24 h`,
        action: 'Run backup',
        to: `${PATHS.SUPERADMIN_SYSTEM_HEALTH}?action=backup`,
      }
    case 'ml_down':
      return {
        tone,
        icon: Cpu,
        title: 'The ML service isn’t answering',
        caption: 'New vouchers still go through and show “AI check pending”',
        action: 'Open system health',
        to: PATHS.SUPERADMIN_SYSTEM_HEALTH,
      }
    case 'failed_jobs':
      return {
        tone,
        icon: RotateCw,
        title: `${plural(item.count, 'background job', 'background jobs')} failed`,
        caption: item.jobs?.length ? item.jobs.join(', ') : 'They will not run again until retried',
        action: 'Retry jobs',
        to: `${PATHS.SUPERADMIN_SYSTEM_HEALTH}?action=retry`,
      }
    case 'security_alerts':
      return {
        tone,
        icon: ShieldAlert,
        title: `${plural(item.count, 'security alert', 'security alerts')} not reviewed`,
        caption: item.latest
          ? `Latest: ${alertShortName(item.latest.type)} · ${item.latest.subject_email}`
          : 'Check who signed in and what changed',
        action: 'Review',
        to: SECURITY_ALERTS_SEARCH,
      }
    case 'company_suspended':
      return {
        tone,
        icon: Building2,
        title: `${item.company.name} is suspended`,
        caption: `Since ${formatTimeAgo(item.suspended_at)} · ${plural(item.users_affected, 'user', 'users')} affected`,
        action: 'Open company',
        to: `${PATHS.SUPERADMIN_COMPANIES}?open=${item.company.id}`,
      }
    default:
      return null
  }
}

/** One admin-account row: { caption, pill: { tone, text } } */
export function describeAdmin(admin) {
  switch (admin.status) {
    case 'pending':
      return {
        caption: withCompany(admin, `Invited ${formatDayAgo(admin.created_at)} · hasn't set a password yet`),
        pill: { tone: 'warning', text: 'Pending' },
      }
    case 'inactive':
      return {
        caption: withCompany(admin, admin.deactivated_at ? `Deactivated ${formatDeactivatedDay(admin.deactivated_at)}` : 'Deactivated'),
        pill: { tone: 'neutral', text: 'Inactive' },
      }
    default:
      return {
        caption: withCompany(admin, admin.last_login_at ? `Signed in ${formatTimeAgo(admin.last_login_at)}` : 'Active'),
        pill: { tone: 'success', text: 'Active' },
      }
  }
}

/** "Apex Holdings · Signed in 5 min ago" (each Admin runs one company since 2026-11-20) */
function withCompany(admin, text) {
  return admin.company ? `${admin.company} · ${text}` : text
}

/** "today" / "yesterday" / "Nov 10" (the design says "Deactivated Nov 10", without "on") */
function formatDeactivatedDay(value) {
  return formatDayAgo(value).replace(/^on /, '')
}

/** AI anomaly sensitivity (the 3 options from the Global settings design, Framer BfnusLHkd) */
export const SENSITIVITY = {
  relaxed: { label: 'Relaxed', caption: 'Flags only clear outliers' },
  balanced: { label: 'Balanced', caption: 'Recommended for most companies' },
  strict: { label: 'Strict', caption: 'Flags more vouchers for a second look' },
}

/** The welcome banner sentence under "Good morning, Felix". */
export function attentionSummary(attentionCount, companies) {
  const where = companies === 0 ? 'No companies have been set up yet.' : null
  if (attentionCount === 0) {
    return where ?? `Nothing needs your attention right now. All ${plural(companies, 'company is', 'companies are')} running normally.`
  }
  const first = `${plural(attentionCount, 'thing needs', 'things need')} your attention today.`
  return `${first} ${where ?? `Everything else across ${plural(companies, 'company', 'companies')} is running normally.`}`
}

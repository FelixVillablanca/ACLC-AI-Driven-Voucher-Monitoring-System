import { differenceInHours, format } from 'date-fns'
import { plural } from '@/lib/formatters'

/** Opens the "Run a database backup now?" dialog on top of ANY Super Admin page. */
export const RUN_BACKUP_PARAM = 'run'
export const RUN_BACKUP_VALUE = 'backup'
export const RUN_BACKUP_SEARCH = `?${RUN_BACKUP_PARAM}=${RUN_BACKUP_VALUE}`

/** Fired when a backup starts or ends, so the dashboard (Services, Needs your attention) refreshes. */
export const BACKUPS_CHANGED_EVENT = 'advms:backups-changed'

export function announceBackupsChanged() {
  window.dispatchEvent(new CustomEvent(BACKUPS_CHANGED_EVENT))
}

// formatBytes moved to lib/formatters (System health uses it too); re-exported for this feature
export { formatBytes } from '@/lib/formatters'

/** "Under a minute" / "About 2 minutes" */
export function formatEstimate(seconds) {
  if (!seconds || seconds < 60) return 'Under a minute'
  return `About ${plural(Math.round(seconds / 60), 'minute', 'minutes')}`
}

/** "45 s" / "3 min" */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  return seconds < 60 ? `${seconds} s` : `${Math.ceil(seconds / 60)} min`
}

/** "Nov 16, 02:00 (26 h ago)" */
export function formatLastBackup(value) {
  if (!value) return 'None yet'
  const date = new Date(value)
  const hours = differenceInHours(new Date(), date)
  const ago = hours < 1 ? 'less than 1 h ago' : hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`
  return `${format(date, 'MMM d, HH:mm')} (${ago})`
}

/** "Saved to": the honest answer until Phase 8 moves backups to encrypted cloud storage. */
export function destinationText(destination) {
  return destination === 'local' ? 'This server · not encrypted yet' : 'Cloud storage · encrypted'
}

/** The grey line under the dialog title. */
export function backupReason(overview) {
  const after = 'Users can keep working while it runs in the background.'
  if (!overview.last_success) return `No backup has been made yet. ${after}`
  if (overview.last_attempt_failed) return `The last backup did not finish. ${after}`
  const hours = differenceInHours(new Date(), new Date(overview.last_success.finished_at))
  if (hours >= overview.overdue_after_hours) return `The last good backup is more than a day old. ${after}`
  return after
}

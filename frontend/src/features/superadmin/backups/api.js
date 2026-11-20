import { apiClient, BACKGROUND } from '@/lib/apiClient'

/**
 * What the "Run a database backup now?" dialog shows:
 * { last_success: { finished_at, size_bytes } | null, last_attempt_failed, overdue_after_hours,
 *   database_size_bytes, estimated_seconds, destination, nightly_at, keep, current: backup | null }
 */
export async function getBackupOverview() {
  const { data } = await apiClient.get('/superadmin/backups/overview')
  return data.data
}

/** Starts a backup (202). 409 BACKUP_IN_PROGRESS = one is already running. */
export async function startBackup({ notify }) {
  const { data } = await apiClient.post('/superadmin/backups', { notify })
  return data.data
}

/**
 * One backup's progress. Asked on a timer while it runs, so it's sent as a BACKGROUND
 * request: it doesn't count as "activity" for the Super Admin idle timeout.
 */
export async function getBackup(id) {
  const { data } = await apiClient.get(`/superadmin/backups/${id}`, BACKGROUND)
  return data.data
}

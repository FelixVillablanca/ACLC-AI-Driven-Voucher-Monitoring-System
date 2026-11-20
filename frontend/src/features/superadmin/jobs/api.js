import { apiClient } from '@/lib/apiClient'

/**
 * Failed background jobs, newest first (at most 50).
 * Returns { jobs: [{ id, name, subject, error, failed_at, max_tries, service, retryable, note }],
 *           total, services: { ml: 'ok' | 'danger' | … } }
 */
export async function listFailedJobs() {
  const { data } = await apiClient.get('/superadmin/failed-jobs')
  return { jobs: data.data, total: data.meta.total, services: data.meta.services }
}

/** Puts the jobs back in the queue. 409 JOB_NOT_RETRYABLE / 404 JOB_NOT_FOUND. Returns how many. */
export async function retryFailedJobs(ids) {
  const { data } = await apiClient.post('/superadmin/failed-jobs/retry', { ids })
  return data.data.retried
}

/** Removes the jobs for good. Returns how many. */
export async function deleteFailedJobs(ids) {
  const { data } = await apiClient.delete('/superadmin/failed-jobs', { data: { ids } })
  return data.data.deleted
}

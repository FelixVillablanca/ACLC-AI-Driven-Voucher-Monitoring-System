import { apiClient, BACKGROUND } from '@/lib/apiClient'

/**
 * The System health page (Framer m80KDanOj).
 * { services: { web, database, queue, scheduler, ml, backup }, attention, checked_at, uptime: { percent, days }, retrying, incidents }
 * `background: true` = the 60-second timer, not a click (doesn't count as activity).
 */
export async function getSystemHealth({ background = false } = {}) {
  const { data } = await apiClient.get('/superadmin/system-health', background ? BACKGROUND : undefined)
  return data.data
}

/** SH1 "↻ Check now": checks every service right now and answers with the fresh page. */
export async function checkNow() {
  const { data } = await apiClient.post('/superadmin/system-health/check')
  return data.data
}

/** SH7 one day of the uptime strip: { stretches, incidents, normal_latency_ms, checks } */
export async function getHealthDay(date) {
  const { data } = await apiClient.get(`/superadmin/system-health/days/${date}`)
  return data.data
}

/** SH4 Background jobs panel: { queue, hours, retrying, failed: { jobs, total } } */
export async function getJobsPanel() {
  const { data } = await apiClient.get('/superadmin/system-health/jobs')
  return data.data
}

/** SH5 one failed job (404 JOB_NOT_FOUND when it was retried or deleted meanwhile). */
export async function getFailedJob(uuid) {
  const { data } = await apiClient.get(`/superadmin/system-health/failed-jobs/${uuid}`)
  return data.data
}

/** SH5 Retry this job / Dismiss: the same endpoints as the Retry failed jobs window. */
export async function retryJob(uuid) {
  await apiClient.post('/superadmin/failed-jobs/retry', { ids: [uuid] })
}
export async function dismissJob(uuid) {
  await apiClient.delete('/superadmin/failed-jobs', { data: { ids: [uuid] } })
}

/** SH10 incident (+ timeline) and "Mark resolved" (note required; 409 when already resolved). */
export async function getIncident(id) {
  const { data } = await apiClient.get(`/superadmin/system-health/incidents/${id}`)
  return data.data
}
export async function resolveIncident(id, note) {
  const { data } = await apiClient.post(`/superadmin/system-health/incidents/${id}/resolve`, { note })
  return data.data
}

/** Blocked addresses card + SH9. */
export async function listBlockedIps() {
  const { data } = await apiClient.get('/superadmin/blocked-ips')
  return data.data
}
export async function getBlockedIp(id) {
  const { data } = await apiClient.get(`/superadmin/blocked-ips/${id}`)
  return data.data
}
export async function unblockIp(id, { watch }) {
  const { data } = await apiClient.post(`/superadmin/blocked-ips/${id}/unblock`, { watch })
  return data.data
}

import { apiClient } from '@/lib/apiClient'

/**
 * One page of alerts, newest first.
 *   status: undefined (All) | 'open' (Not reviewed) | 'closed' (Reviewed)
 *   cursor: the `next_cursor` from the previous page ("Load more")
 * Returns { alerts, nextCursor, counts: { all, open, closed, last_24h } }
 */
export async function listSecurityAlerts({ status, cursor } = {}) {
  const params = {}
  if (status) params['filter[status]'] = status
  if (cursor) params.cursor = cursor
  const { data } = await apiClient.get('/superadmin/security-alerts', { params })
  return { alerts: data.data, nextCursor: data.meta?.next_cursor ?? null, counts: data.meta.counts }
}

/** Everything the Alert detail panel shows (account, what happened, which buttons work). */
export async function getSecurityAlert(id) {
  const { data } = await apiClient.get(`/superadmin/security-alerts/${id}`)
  return data.data
}

/** "Mark as reviewed". 409 ALERT_ALREADY_CLOSED = another Super Admin was faster. */
export async function reviewSecurityAlert(id) {
  const { data } = await apiClient.post(`/superadmin/security-alerts/${id}/review`)
  return data.data
}

/** "Dismiss" = not a real problem. */
export async function dismissSecurityAlert(id) {
  const { data } = await apiClient.post(`/superadmin/security-alerts/${id}/dismiss`)
  return data.data
}

/** "Mark all as reviewed". Returns how many were marked. */
export async function reviewAllSecurityAlerts() {
  const { data } = await apiClient.post('/superadmin/security-alerts/review-all')
  return data.data.reviewed
}

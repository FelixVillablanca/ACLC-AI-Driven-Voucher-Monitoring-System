import { apiClient, BACKGROUND } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/** The filters as query parameters (the same for the list and "Match the filters" export). */
export function filterParams({ search, companies, actions, from, to, sensitive }) {
  return {
    search: search || undefined,
    companies: companies?.length ? companies : undefined,
    actions: actions?.length ? actions : undefined,
    from: from || undefined,
    to: to || undefined,
    sensitive: sensitive ? 1 : undefined,
  }
}

/**
 * One page of the Audit logs table (Framer EJ0asP2ZH), newest first.
 * Returns { entries, meta: { total, from, to, last_page, range, facets, summary, ip } }.
 * `background: true` = the "● Live" timer asked, not a click (doesn't count as activity).
 */
export async function listAuditLogs(filters, page = 1, { background = false } = {}) {
  const { data } = await apiClient.get('/superadmin/audit-logs', {
    params: { ...filterParams(filters), page },
    ...(background ? BACKGROUND : {}),
  })
  return { entries: data.data, meta: data.meta }
}

/** What the company (AL3) and action (AL4) dropdowns offer. { companies, groups } */
export async function getAuditOptions() {
  const { data } = await apiClient.get('/superadmin/audit-logs/options')
  return data.data
}

/** AL7 Event details: the entry + integrity, same_request, more_from_person_that_day, target. */
export async function getAuditEntry(id) {
  const { data } = await apiClient.get(`/superadmin/audit-logs/${id}`)
  return data.data
}

/** What one IP address did today (AL2 banner / AL8 evidence). */
export async function getIpActivity(ip) {
  const { data } = await apiClient.get(`/superadmin/audit-logs/ip/${encodeURIComponent(ip)}`)
  return data.data
}

/**
 * AL1 Export: downloads a CSV and returns its file name.
 *   { from, to, events: 'all'|'sensitive'|'filters', include: ['values','request'], filters }
 */
export async function exportAuditLog({ from, to, events, include, filters }) {
  const response = await apiClient.get('/superadmin/audit-logs/export', {
    params: { ...(events === 'filters' ? filterParams(filters) : {}), from, to, events, include },
    responseType: 'blob',
    validateStatus: () => true, // an error answer is a blob too; saveDownload reads it
  })
  return saveDownload(response, 'audit-log.csv')
}

/** AL8 Block. Returns { block, accountsEmailed }. 409 IP_ALREADY_BLOCKED, 422 IP_IS_YOURS / validation. */
export async function blockIp({ ip, duration, reason, notifyAccounts }) {
  const { data } = await apiClient.post('/superadmin/blocked-ips', {
    ip_address: ip,
    duration,
    reason,
    notify_accounts: notifyAccounts,
  })
  return { block: data.data, accountsEmailed: data.meta.accounts_emailed }
}

export async function unblockIp(id) {
  const { data } = await apiClient.post(`/superadmin/blocked-ips/${id}/unblock`)
  return data.data
}

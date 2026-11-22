import { apiClient } from '@/lib/apiClient'

/**
 * One page (25) of YOUR company's audit log, newest first. Voucher activity is never included.
 *   { search, group: 'security'|'users'|'settings'|'system', from, to (YYYY-MM-DD), sensitive, page }
 * No dates = the last 7 days. Returns { entries, meta: { current_page, last_page, total, range, groups, group_options, summary } }
 */
export async function listAuditLogs({ search, group, from, to, sensitive, page = 1, signal } = {}) {
  const params = { page }
  if (search) params.search = search
  if (group) params.group = group
  if (from) params.from = from
  if (to) params.to = to
  if (sensitive) params.sensitive = 1
  const { data } = await apiClient.get('/admin/audit-logs', { params, signal })
  return { entries: data.data, meta: data.meta }
}

/** One entry + its tamper check (integrity: intact | changed | not_sealed). 404 outside your company. */
export async function getAuditEntry(id) {
  const { data } = await apiClient.get(`/admin/audit-logs/${id}`)
  return data.data
}

import { apiClient } from '@/lib/apiClient'

/**
 * People in YOUR company who can't open it yet (no access, waiting, or refused before), A–Z.
 * Returns { people, meta: { total, shown, company } }
 */
export async function listAccessCandidates({ search, signal } = {}) {
  const { data } = await apiClient.get('/admin/company-access/candidates', { params: search ? { search } : {}, signal })
  return { people: data.data, meta: data.meta }
}

/**
 * Gives the chosen people access to YOUR company. Returns { granted: [people], count }.
 * 409 ACCESS_LIST_CHANGED = someone already got access or left meanwhile (refresh the list).
 */
export async function grantCompanyAccess(userIds) {
  const { data } = await apiClient.post('/admin/company-access', { user_ids: userIds })
  return { granted: data.data, count: data.meta.granted }
}

/**
 * The Company access page: everyone connected to YOUR company + their access.
 *   { view: 'has_access'|'no_access'|'other_companies', search, sort, page }
 * Returns { people, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listCompanyAccess({ view, search, sort, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort) params.sort = sort
  const { data } = await apiClient.get('/admin/company-access', { params })
  return { people: data.data, meta: data.meta }
}

/** Remove access (reason optional). 409 ACCESS_NOT_GRANTED = it was already removed. */
export async function revokeCompanyAccess(userId, reason) {
  const { data } = await apiClient.post(`/admin/company-access/${userId}/revoke`, { reason: reason || null })
  return data.data
}

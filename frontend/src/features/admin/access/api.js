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

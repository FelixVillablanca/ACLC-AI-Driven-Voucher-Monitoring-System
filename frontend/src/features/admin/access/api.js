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
 * The Company access page list.
 *   view: 'in_company' (your own people, default) | 'other_companies' (people of other companies who work here)
 *   access: 'has' | 'none' (In your company only), search, sort, page
 * Returns { people, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listCompanyAccess({ view, access, search, sort, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (access) params['filter[access]'] = access
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

/**
 * People of OTHER companies you could invite: name, role and home company only (privacy rule).
 * Returns { people, meta: { current_page, last_page, total } }
 */
export async function listInvitable({ search, page = 1, signal } = {}) {
  const { data } = await apiClient.get('/admin/company-access/directory', { params: { page, ...(search ? { search } : {}) }, signal })
  return { people: data.data, meta: data.meta }
}

/** Open requests (people asking to join) and the invitations you sent: { requests, invites }. */
export async function getPendingAccess() {
  const { data } = await apiClient.get('/admin/company-access/pending')
  return data.data
}

/** Invite someone of another company. 409 ACCESS_ALREADY_OPEN / SAME_COMPANY, 404 if they can't be invited. */
export async function inviteToCompany(userId, message) {
  const { data } = await apiClient.post('/admin/company-access/invitations', { user_id: userId, message: message || null })
  return data.data
}

/** Withdraw an invitation that wasn't answered yet. 404 NOTHING_PENDING = already answered. */
export async function cancelInvitation(userId) {
  await apiClient.delete(`/admin/company-access/invitations/${userId}`)
}

/** Approve / decline a request to join (decline: optional reason). 404 NOTHING_PENDING = already answered. */
export async function answerJoinRequest(userId, approve, reason) {
  const { data } = await apiClient.post(
    `/admin/company-access/requests/${userId}/${approve ? 'approve' : 'decline'}`,
    approve ? {} : { reason: reason || null },
  )
  return data.data
}

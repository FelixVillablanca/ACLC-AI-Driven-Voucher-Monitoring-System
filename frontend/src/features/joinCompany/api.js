import { apiClient } from '@/lib/apiClient'

/**
 * YOUR companies (as a clerk / officer / supervisor): { companies, invitations, requests, can_ask }.
 * `search` narrows the companies you could ask to join (by name).
 */
export async function getMyCompanyAccess({ search, signal } = {}) {
  const { data } = await apiClient.get('/me/company-access', { params: search ? { search } : {}, signal })
  return data.data
}

/** Ask to join a company (its Admin answers). 409 ACCESS_ALREADY_OPEN, 404 COMPANY_UNAVAILABLE. */
export async function requestToJoin(companyId, message) {
  const { data } = await apiClient.post('/me/company-access/requests', { company_id: companyId, message: message || null })
  return data.data
}

/** Withdraw your request. 404 NOTHING_PENDING = it was already answered. */
export async function cancelJoinRequest(companyId) {
  await apiClient.delete(`/me/company-access/requests/${companyId}`)
}

/** Accept / decline an invitation. 404 NOTHING_PENDING = withdrawn or already answered. */
export async function answerInvitation(companyId, accept) {
  await apiClient.post(`/me/company-access/invitations/${companyId}/${accept ? 'accept' : 'decline'}`)
}

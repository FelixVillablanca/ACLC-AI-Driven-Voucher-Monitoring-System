import { apiClient } from '@/lib/apiClient'

/** What the voucher form's lists offer in the active company. */
export async function getVoucherFormOptions() {
  const { data } = await apiClient.get('/vouchers/form-options')
  return data.data
}

/**
 * My vouchers. { view: 'draft'|'in_review'|'returned'|'approved'|'rejected'|'cancelled', search, sort, page }
 * Returns { vouchers, meta: { current_page, last_page, from, to, total, counts } }
 */
export async function listVouchers({ view, search, sort, page = 1, signal } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort) params.sort = sort
  const { data } = await apiClient.get('/vouchers', { params, signal })
  return { vouchers: data.data, meta: data.meta }
}

export async function getVoucher(id) {
  const { data } = await apiClient.get(`/vouchers/${id}`)
  return data.data
}

/** New draft. The total is never sent: the server adds up the lines. 422 = field errors. */
export async function createVoucher(values) {
  const { data } = await apiClient.post('/vouchers', values)
  return data.data
}

/** Save a draft / returned voucher. 409 VOUCHER_CHANGED (edited elsewhere) or VOUCHER_LOCKED (with a reviewer). */
export async function updateVoucher(id, values, updatedAt) {
  const { data } = await apiClient.patch(`/vouchers/${id}`, { ...values, updated_at: updatedAt })
  return data.data
}

/** Send to the Accounting Officer. 422 = what's still missing (field errors); 409 INVALID_TRANSITION. */
export async function submitVoucher(id) {
  const { data } = await apiClient.post(`/vouchers/${id}/submit`)
  return data.data
}

export async function cancelVoucher(id) {
  const { data } = await apiClient.post(`/vouchers/${id}/cancel`)
  return data.data
}

/**
 * Delete a never-submitted draft for good. `updatedAt` = the version on screen:
 * 409 VOUCHER_CHANGED if it was saved elsewhere since, 409 DRAFT_NOT_DELETABLE if it was submitted.
 */
export async function deleteDraft(id, updatedAt) {
  await apiClient.delete(`/vouchers/${id}`, { data: { updated_at: updatedAt } })
}

/** Delete several drafts at once (Select mode). All or nothing. Returns how many were deleted. */
export async function deleteDrafts(ids) {
  const { data } = await apiClient.post('/vouchers/drafts/delete', { ids })
  return data.data.deleted
}

/** The current approval rules (high-value threshold, AI-flagged → step 2) for the approval guide. */
export async function getApprovalRules() {
  const { data } = await apiClient.get('/approval-rules')
  return data.data
}

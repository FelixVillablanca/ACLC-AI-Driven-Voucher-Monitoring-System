import { apiClient, BACKGROUND } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/** The Supervisor / Manager's Level 2 (2026-11-27). Company = the one in the switcher. Money arrives as text. */

/** Sidebar + cleared-state numbers: { queue: { total, ai_flagged, total_amount }, today, threshold } */
export async function getSupervisorSummary({ background = false } = {}) {
  const { data } = await apiClient.get('/supervisor/summary', background ? BACKGROUND : undefined)
  return data.data
}

/** Needs-changes tags + reject reasons (the same lists Accounting uses). */
export async function getSupervisorOptions() {
  const { data } = await apiClient.get('/supervisor/review-options')
  return data.data
}

/** The Level 2 queue: { view, search, sort, page } → { vouchers, meta: { counts, total_amount, threshold, … } } */
export async function listLevel2Queue({ view, search, sort, page = 1, signal } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort && sort !== 'oldest') params.sort = sort
  const { data } = await apiClient.get('/supervisor/queue', { params, signal })
  return { vouchers: data.data, meta: data.meta }
}

/** One voucher + the Level 2 review block (Level 1 approver, step-2 reasons, budget, similar, position). */
export async function getLevel2Voucher(id) {
  const { data } = await apiClient.get(`/supervisor/vouchers/${id}`)
  return data.data
}

export async function finalApprove(id, remarks) {
  const { data } = await apiClient.post(`/supervisor/vouchers/${id}/approve`, { remarks: remarks || null })
  return data.data
}

/** sendTo: 'clerk' | 'accounting' */
export async function returnLevel2(id, sendTo, needsChanges, remarks) {
  const { data } = await apiClient.post(`/supervisor/vouchers/${id}/return`, { send_to: sendTo, needs_changes: needsChanges, remarks })
  return data.data
}

export async function rejectLevel2(id, reason, remarks) {
  const { data } = await apiClient.post(`/supervisor/vouchers/${id}/reject`, { reason, remarks })
  return data.data
}

/** All or nothing; flagged ones are refused (409 BULK_NOT_ALLOWED). → { approved, vouchers } */
export async function bulkFinalApprove(ids) {
  const { data } = await apiClient.post('/supervisor/vouchers/bulk-approve', { ids })
  return data.data
}

/** Decision history: { reviews, meta: { …, today } } */
export async function listMyDecisions({ action, page = 1 } = {}) {
  const params = { page }
  if (action) params['filter[action]'] = action
  const { data } = await apiClient.get('/supervisor/reviews', { params })
  return { reviews: data.data, meta: data.meta }
}

export async function downloadLevel2Pdf(id) {
  const response = await apiClient.get(`/supervisor/vouchers/${id}/pdf`, { responseType: 'blob', validateStatus: () => true })
  return saveDownload(response, 'voucher.pdf')
}

/** Flagged vouchers waiting for Level 2 (Framer ESBUdF0jl): { vouchers, meta: { stats, threshold, … } }. sort: score | oldest | amount_desc */
export async function listLevel2Flagged({ sort, page = 1, background = false } = {}) {
  const params = { page }
  if (sort && sort !== 'score') params.sort = sort
  const { data } = await apiClient.get('/supervisor/flagged', { params, ...(background ? BACKGROUND : {}) })
  return { vouchers: data.data, meta: data.meta }
}

/** Investigate a flag (Framer lFqUUsfzi): signals, 6-month history, summary, past payments to the payee. */
export async function getLevel2Investigation(id) {
  const { data } = await apiClient.get(`/supervisor/vouchers/${id}/investigation`)
  return data.data
}

import { apiClient, BACKGROUND } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/** Sidebar numbers + today's reviews: { queue: { total, ai_flagged, near_sla, total_amount }, today, sla_hours } */
export async function getOfficerSummary({ background = false } = {}) {
  const { data } = await apiClient.get('/officer/summary', background ? BACKGROUND : undefined)
  return data.data
}

/** Departments (filter), needs-changes tags, reject reasons and the current routing rules. */
export async function getReviewOptions() {
  const { data } = await apiClient.get('/officer/review-options')
  return data.data
}

/**
 * The review queue. { view, department, amountMin, amountMax, search, sort, page }
 * Returns { vouchers, meta: { …paginator, counts, total_amount, sla_hours } }
 */
export async function listQueue({ view, department, amountMin, amountMax, search, sort, page = 1, signal } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (department) params['filter[department]'] = department
  if (amountMin) params['filter[amount_min]'] = amountMin
  if (amountMax) params['filter[amount_max]'] = amountMax
  if (search) params.search = search
  if (sort && sort !== 'oldest') params.sort = sort
  const { data } = await apiClient.get('/officer/queue', { params, signal })
  return { vouchers: data.data, meta: data.meta }
}

/** The first voucher to review ("Review next"): its id, or null when the queue is empty. */
export async function getNextInQueue() {
  const { data } = await apiClient.get('/officer/queue/next')
  return data.data.id
}

/** One voucher with the review block (route, SLA, similar vouchers, budget, position in the queue). */
export async function getReviewVoucher(id) {
  const { data } = await apiClient.get(`/officer/vouchers/${id}`)
  return data.data
}

/** → { id, voucher_number, status, next_id, forwarded, supervisors }. 409 VOUCHER_ALREADY_REVIEWED, 403 SELF_REVIEW. */
export async function approveVoucher(id, remarks, aiFinding = null) {
  const { data } = await apiClient.post(`/officer/vouchers/${id}/approve`, { remarks: remarks || null, ai_finding: aiFinding })
  return data.data
}

/** needsChanges = ['line_items', …]; remarks required. 422 = field errors. */
export async function returnVoucher(id, needsChanges, remarks, aiFinding = null) {
  const { data } = await apiClient.post(`/officer/vouchers/${id}/return`, { needs_changes: needsChanges, remarks, ai_finding: aiFinding })
  return data.data
}

export async function rejectVoucher(id, reason, remarks) {
  const { data } = await apiClient.post(`/officer/vouchers/${id}/reject`, { reason, remarks })
  return data.data
}

/** All or nothing; AI-flagged ones are refused (409 BULK_NOT_ALLOWED). → { approved, forwarded, vouchers } */
export async function bulkApprove(ids) {
  const { data } = await apiClient.post('/officer/vouchers/bulk-approve', { ids })
  return data.data
}

/** "Reviewed by me": { reviews, meta: { …, today: { approved, returned, rejected, total, last_reviewed_at } } } */
export async function listMyReviews({ action, page = 1 } = {}) {
  const params = { page }
  if (action) params['filter[action]'] = action
  const { data } = await apiClient.get('/officer/reviews', { params })
  return { reviews: data.data, meta: data.meta }
}

export async function downloadVoucherPdf(id) {
  const response = await apiClient.get(`/officer/vouchers/${id}/pdf`, { responseType: 'blob', validateStatus: () => true })
  return saveDownload(response, `voucher-${id}.pdf`)
}

/** Flagged vouchers nobody has looked into yet (highest score first) + this month's stats. */
export async function listFlagged({ page = 1 } = {}) {
  const { data } = await apiClient.get('/officer/flagged', { params: { page } })
  return { vouchers: data.data, meta: data.meta }
}

/** The Investigate page: 6-month history, signals, plain summary, score, finding. */
export async function getInvestigation(id) {
  const { data } = await apiClient.get(`/officer/vouchers/${id}/investigation`)
  return data.data
}

/** "False alarm" / "Mark as normal": clears the flag. 409 FLAG_ALREADY_REVIEWED. → { …, next_flagged_id } */
export async function markNormal(id, note) {
  const { data } = await apiClient.post(`/officer/vouchers/${id}/normal`, { note: note || null })
  return data.data
}

/**
 * Vouchers an officer may name in Contact support (Help & guides, 2026-11-27): the queue's first page + what you
 * reviewed lately, newest first, no duplicates. [{ id, voucher_number, payee_name }]
 */
export async function recentVouchersForSupport() {
  const [queue, reviews] = await Promise.all([
    listQueue({ page: 1 }).catch(() => ({ vouchers: [] })),
    listMyReviews({ page: 1 }).catch(() => ({ reviews: [] })),
  ])
  const seen = new Set()
  return [...reviews.reviews.map((r) => r.voucher), ...queue.vouchers]
    .filter((v) => v && !seen.has(v.id) && seen.add(v.id))
    .slice(0, 20)
    .map((v) => ({ id: v.id, voucher_number: v.voucher_number, payee_name: v.payee_name }))
}

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

/** Decision history (Framer K_vQYIg74): month = "2026-11" | "all" → { reviews, meta: { counts, stats, months, month, today, … } } */
function historyParams({ month, action, search }) {
  const params = {}
  if (month) params.month = month
  if (action) params['filter[action]'] = action
  if (search) params.search = search
  return params
}

export async function listMyDecisions({ month, action, search, page = 1, signal } = {}) {
  const { data } = await apiClient.get('/supervisor/reviews', { params: { ...historyParams({ month, action, search }), page }, signal })
  return { reviews: data.data, meta: data.meta }
}

/** The same filters as a CSV file (saved by the browser). */
export async function exportMyDecisions({ month, action, search } = {}) {
  const response = await apiClient.get('/supervisor/reviews/export', {
    params: historyParams({ month, action, search }),
    responseType: 'blob',
    validateStatus: () => true,
  })
  return saveDownload(response, 'decisions.csv')
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

/** Supervisor Budgets (Framer adI8wBXHd): the overview (same numbers as Accounting's) + pending change requests. */
export async function getSupervisorBudgets({ year } = {}) {
  const { data } = await apiClient.get('/supervisor/budgets', { params: year ? { year } : undefined })
  return data.data
}

/** Sign off a budget change (Framer KHqkVA77a). approvedBudget = the new total ("2500000.00"); null = what was asked. */
export async function approveBudgetChange(id, approvedBudget, note) {
  const { data } = await apiClient.post(`/supervisor/budgets/requests/${id}/approve`, {
    approved_budget: approvedBudget,
    note: note || null,
  })
  return data.data
}

export async function declineBudgetChange(id, note) {
  const { data } = await apiClient.post(`/supervisor/budgets/requests/${id}/decline`, { note })
  return data.data
}

/** Supervisor Forecasts (Framer wY0BB3HcK), read-only: company (no id) or one department → board data + year_end. */
export async function getSupervisorForecasts({ department, signal } = {}) {
  const { data } = await apiClient.get('/supervisor/forecasts', { params: department ? { department } : undefined, signal })
  return data.data
}

/** Audit trail (Framer xqItzoFYK): filters = { range, from, to, search, user, action, table, page } → { entries, meta } */
function auditParams(f) {
  return Object.fromEntries(Object.entries(f).filter(([k, v]) => k !== 'signal' && v != null && v !== ''))
}

export async function listSupervisorAudit(filters = {}) {
  const { data } = await apiClient.get('/supervisor/audit', { params: auditParams(filters), signal: filters.signal })
  return { entries: data.data, meta: data.meta }
}

/** One entry (Framer cm5eFM0vJ): + table, record_id, link, integrity. */
export async function getSupervisorAuditEntry(id) {
  const { data } = await apiClient.get(`/supervisor/audit/${id}`)
  return data.data
}

export async function exportSupervisorAudit(filters = {}) {
  const response = await apiClient.get('/supervisor/audit/export', {
    params: auditParams({ ...filters, page: undefined }),
    responseType: 'blob',
    validateStatus: () => true,
  })
  return saveDownload(response, 'audit-trail.csv')
}

/** Financial reports (Framer AaD8UZ08p): { type, signoff, page } → { reports, meta: { stats: { …, to_sign }, ai, … } } */
export async function listSupervisorReports({ type, signoff, page = 1, signal } = {}) {
  const params = { page }
  if (type) params.type = type
  if (signoff) params.signoff = signoff
  const { data } = await apiClient.get('/supervisor/reports', { params, signal })
  return { reports: data.data, meta: data.meta }
}

/** One report + the sign-off checklist (Framer dcfDyyuKE). */
export async function getSupervisorReport(id, { background = false } = {}) {
  const { data } = await apiClient.get(`/supervisor/reports/${id}`, background ? BACKGROUND : undefined)
  return data.data
}

export async function signOffReport(id, checks, comment) {
  const { data } = await apiClient.post(`/supervisor/reports/${id}/signoff`, { checks, comment: comment || null })
  return data.data
}

export async function sendReportBack(id, note) {
  const { data } = await apiClient.post(`/supervisor/reports/${id}/return`, { note })
  return data.data
}

export async function downloadSupervisorReportPdf(id) {
  const response = await apiClient.get(`/supervisor/reports/${id}/pdf`, { responseType: 'blob', validateStatus: () => true })
  return saveDownload(response, 'report.pdf')
}

/** Contact support's "Related voucher" (Framer mZNmzhDdX): your Level 2 queue + the vouchers you decided lately (≤ 20). */
export async function recentVouchersForSupport() {
  const [queue, decisions] = await Promise.all([
    listLevel2Queue({ page: 1 }).catch(() => ({ vouchers: [] })),
    listMyDecisions({ month: 'all', page: 1 }).catch(() => ({ reviews: [] })),
  ])
  const seen = new Set()
  return [...queue.vouchers, ...decisions.reviews.map((r) => r.voucher)]
    .filter((v) => v && !seen.has(v.id) && seen.add(v.id))
    .slice(0, 20)
    .map((v) => ({ id: v.id, voucher_number: v.voucher_number, payee_name: v.payee_name }))
}

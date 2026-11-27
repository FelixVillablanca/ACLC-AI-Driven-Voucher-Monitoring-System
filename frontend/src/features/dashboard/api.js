import { apiClient, BACKGROUND } from '@/lib/apiClient'

/**
 * The Accounting Clerk's landing page numbers (GET /api/v1/clerk/dashboard). The company is the one in
 * X-Company-ID (useCompanyStore, added by apiClient). Money comes as strings (DECIMAL).
 *   { company, department, counts: { all, drafts, returned, with_officer, with_supervisor }, drafts_total,
 *     approved_this_month: { count, total, month }, recent: [...], needs_attention: [...] }
 */
export async function getClerkDashboard({ signal } = {}) {
  const { data } = await apiClient.get('/clerk/dashboard', { signal })
  return data.data
}

/** The Accounting Officer's dashboard (Framer tfDekIe0N): queue, your month, review time, top 4, budgets, spend. */
export async function getOfficerDashboard({ background = false } = {}) {
  const { data } = await apiClient.get('/officer/dashboard', background ? BACKGROUND : undefined)
  return data.data
}

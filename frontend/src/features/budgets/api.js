import { apiClient } from '@/lib/apiClient'

/**
 * The Accounting Officer's yearly department budgets (2026-11-27). Company = the one in the switcher.
 * Money goes both ways as text ("1600000.00"), never as a float.
 */

/** Overview (Framer AwnFnuBYJ): { fiscal_year, label, years, period, summary, rows, can_allocate, signoff_above } */
export async function getBudgets(year, { signal } = {}) {
  const { data } = await apiClient.get('/officer/budgets', { params: year ? { year } : {}, signal })
  return data.data
}

/** One department (Framer kpJmhDxKE): numbers, monthly spend, categories, pending request, history. */
export async function getDepartmentBudget(departmentId, year, { signal } = {}) {
  const { data } = await apiClient.get(`/officer/budgets/departments/${departmentId}`, { params: year ? { year } : {}, signal })
  return data.data
}

/** "+ Allocate budget": { department_id, fiscal_year, total_budget, alert_threshold_pct, reason? } → 201 */
export async function allocateBudget(payload) {
  const { data } = await apiClient.post('/officer/budgets', payload)
  return data.data
}

/**
 * Edit allocation (Framer MGf9CXv2s): { total_budget, alert_threshold_pct, reason, was_total, was_alert_pct }.
 * Returns { applied, request_id }: applied = false when it went to a Supervisor for sign-off (202).
 */
export async function updateBudget(id, payload) {
  const { data } = await apiClient.patch(`/officer/budgets/${id}`, payload)
  return data.data
}

/** Take back your own change request that is still waiting for sign-off. */
export async function cancelBudgetRequest(requestId) {
  await apiClient.delete(`/officer/budgets/requests/${requestId}`)
}

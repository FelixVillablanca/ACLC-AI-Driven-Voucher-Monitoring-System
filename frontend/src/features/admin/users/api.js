import { apiClient } from '@/lib/apiClient'

/** Companies (active first) with their departments, for the form's dropdowns and checkboxes. */
export async function getCompanyOptions() {
  const { data } = await apiClient.get('/admin/lookups/companies')
  return data.data
}

/** The Employee ID the next new user will get, e.g. "EMP-2026-0009" (a preview; nothing is reserved). */
export async function getNextEmployeeId() {
  const { data } = await apiClient.get('/admin/users/next-employee-id')
  return data.data.employee_id
}

/** Creates a user and returns them. Throws an ApiError (422 = field errors to show under the inputs). */
export async function createUser(values) {
  const { data } = await apiClient.post('/admin/users', values)
  return data.data
}

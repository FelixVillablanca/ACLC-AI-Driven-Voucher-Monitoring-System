import { apiClient } from '@/lib/apiClient'

/** Active clerks / officers / supervisors of your company, A–Z (the "Department head" choices). */
export async function getCompanyPeople() {
  const { data } = await apiClient.get('/admin/lookups/people')
  return data.data
}

/**
 * Adds a department to YOUR company (the server picks the company). Returns the department.
 * 422 = a field is wrong (e.g. "Your company already uses this code."); 403 NO_ACTIVE_COMPANY.
 */
export async function createDepartment(values) {
  const { data } = await apiClient.post('/admin/departments', values)
  return data.data
}

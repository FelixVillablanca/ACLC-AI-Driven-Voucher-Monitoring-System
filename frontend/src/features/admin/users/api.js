import { apiClient } from '@/lib/apiClient'

/** Your company with its departments (the form's department choices). The server only returns your own company. */
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

/**
 * One page of the Users page: { view, role, department ('none' or an id), search, sort, page }.
 * Returns { users, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listUsers({ view, role, department, search, sort, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (role) params['filter[role]'] = role
  if (department) params['filter[department]'] = department
  if (search) params.search = search
  if (sort) params.sort = sort
  const { data } = await apiClient.get('/admin/users', { params })
  return { users: data.data, meta: data.meta }
}

/** The side panel: one person of YOUR company (404 for anyone else). */
export async function getUser(id) {
  const { data } = await apiClient.get(`/admin/users/${id}`)
  return data.data
}

/**
 * Edit (name, role, department). Send the person's `updated_at` from when the form opened.
 * Returns { user, changed, signedOut }. 409 USER_CHANGED = someone saved them meanwhile.
 */
export async function updateUser(id, values, updatedAt) {
  const { data } = await apiClient.patch(`/admin/users/${id}`, { ...values, updated_at: updatedAt })
  return { user: data.data, changed: data.meta?.changed ?? [], signedOut: Boolean(data.meta?.signed_out) }
}

/** Deactivate (reason optional) / reactivate. 409 = already in that state. */
export async function setUserActive(id, active, reason) {
  const { data } = await apiClient.post(
    `/admin/users/${id}/${active ? 'reactivate' : 'deactivate'}`,
    active ? {} : { reason: reason || null },
  )
  return data.data
}

/** A new sign-in password (generated in the form). The person is signed out everywhere. */
export async function setUserPassword(id, password) {
  const { data } = await apiClient.post(`/admin/users/${id}/password`, { password })
  return data.data
}

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

/**
 * One page of the Departments page. { view: 'active'|'inactive'|'no_head', search, sort, page }
 * Returns { departments, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listDepartments({ view, search, sort, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort) params.sort = sort
  const { data } = await apiClient.get('/admin/departments', { params })
  return { departments: data.data, meta: data.meta }
}

/** The side panel: one department of YOUR company (404 for any other). */
export async function getDepartment(id) {
  const { data } = await apiClient.get(`/admin/departments/${id}`)
  return data.data
}

/** The side panel's people list, A–Z, 20 a page. Returns { items, meta } */
export async function listDepartmentMembers(id, page = 1) {
  const { data } = await apiClient.get(`/admin/departments/${id}/members`, { params: { page } })
  return { items: data.data, meta: data.meta }
}

/**
 * Edit. Send the department's `updated_at` from when the form opened.
 * Returns { department, changed }. 409 DEPARTMENT_CHANGED = someone saved it meanwhile.
 */
export async function updateDepartment(id, values, updatedAt) {
  const { data } = await apiClient.patch(`/admin/departments/${id}`, { ...values, updated_at: updatedAt })
  return { department: data.data, changed: data.meta?.changed ?? [] }
}

/** Deactivate (reason optional) / reactivate. 409 = it's already in that state. */
export async function setDepartmentActive(id, active, reason) {
  const { data } = await apiClient.post(`/admin/departments/${id}/${active ? 'reactivate' : 'deactivate'}`, { reason: reason || null })
  return data.data
}

// ------------------------------------------------------------------ people in a department (2026-11-28)

/**
 * "Add people" picker: active users of your company not in this department yet (at most 50, A–Z).
 * Returns { people: [{ id, full_name, email, role, department: { id, name } | null, heads_department }], companyUsers }.
 */
export async function listDepartmentCandidates(id, search = '') {
  const { data } = await apiClient.get(`/admin/departments/${id}/candidates`, { params: search ? { search } : {} })
  return { people: data.data, companyUsers: data.meta.company_users }
}

/** Adds people as members; `headId` (optional) becomes the head. 409 DEPARTMENT_HAS_HEAD unless `replaceHead`. */
export async function addDepartmentPeople(id, { userIds, headId = null, replaceHead = false }) {
  const { data } = await apiClient.post(`/admin/departments/${id}/people`, {
    user_ids: userIds,
    head_user_id: headId,
    replace_head: replaceHead,
  })
  return { department: data.data, added: data.meta.added, moved: data.meta.moved, head: data.meta.head }
}

/** Makes one person the department's head (they join it if needed). 409 DEPARTMENT_HAS_HEAD unless `replaceHead`. */
export async function setDepartmentHead(id, userId, replaceHead = false) {
  const { data } = await apiClient.post(`/admin/departments/${id}/head`, { user_id: userId, replace_head: replaceHead })
  return data.data
}

/** The department has no head any more (the person stays a member). */
export async function clearDepartmentHead(id) {
  const { data } = await apiClient.delete(`/admin/departments/${id}/head`)
  return data.data
}

/** Takes a person out of the department (they have no department after). */
export async function removeFromDepartment(id, userId) {
  const { data } = await apiClient.delete(`/admin/departments/${id}/people/${userId}`)
  return data.data
}

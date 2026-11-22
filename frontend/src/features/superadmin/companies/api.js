import { apiClient } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/**
 * One page of the Companies tab (Framer vnNFYExpX).
 *   { view: 'active'|'suspended' (none = All), search, sort, suspendedFirst, page }
 * Returns { companies, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listCompanies({ view, search, sort, suspendedFirst, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort) params.sort = sort
  if (suspendedFirst) params.suspended_first = 1
  const { data } = await apiClient.get('/superadmin/companies', { params })
  return { companies: data.data, meta: data.meta }
}

/**
 * Suspend (C6). Returns { company, signedOut, adminsNotified: true|false|null }
 * (null = there was no Admin to tell, or "notify" was unticked).
 * 422 = reason missing; 409 = someone else already suspended it.
 */
export async function suspendCompany(id, { reason, notifyAdmin }) {
  const { data } = await apiClient.post(`/superadmin/companies/${id}/suspend`, { reason, notify_admin: notifyAdmin })
  return { company: data.data, signedOut: data.meta.signed_out, adminsNotified: data.meta.admins_notified }
}

/**
 * Export (C1): downloads an .xlsx, .csv or .pdf and returns the file name.
 *   companies: 'all' | 'active' | 'suspended' | 'search' (+ search)
 *   columns: ['details', 'counts', 'suspension']   sort / suspendedFirst: the screen's order
 */
export async function exportCompanies({ format, companies, search, columns, sort, suspendedFirst }) {
  const response = await apiClient.get('/superadmin/companies/export', {
    params: {
      format,
      companies,
      search: companies === 'search' ? search : undefined,
      columns,
      sort: sort || undefined,
      suspended_first: suspendedFirst ? 1 : undefined,
    },
    responseType: 'blob',
    validateStatus: () => true, // an error answer is a blob too; saveDownload reads it
  })
  return saveDownload(response, `company-list.${format}`)
}

/** C8 side panel: header + Overview tab (card data + contact, two-step count, largest departments). */
export async function getCompany(id) {
  const { data } = await apiClient.get(`/superadmin/companies/${id}`)
  return data.data
}

/** C8 Departments tab: every department, biggest first. */
export async function listCompanyDepartments(id) {
  const { data } = await apiClient.get(`/superadmin/companies/${id}/departments`)
  return data.data
}

/** C8 Users tab: 20 people a page, A–Z. Returns { items, meta } */
export async function listCompanyUsers(id, page = 1) {
  const { data } = await apiClient.get(`/superadmin/companies/${id}/users`, { params: { page } })
  return { items: data.data, meta: data.meta }
}

/** C8 History tab: suspended / reactivated…, newest first. meta.created_at = when it was added. */
export async function listCompanyHistory(id, page = 1) {
  const { data } = await apiClient.get(`/superadmin/companies/${id}/history`, { params: { page } })
  return { items: data.data, meta: data.meta }
}

/** Reactivate (C7). Returns { company, adminsNotified } */
export async function reactivateCompany(id, { note, notifyAdmin }) {
  const { data } = await apiClient.post(`/superadmin/companies/${id}/reactivate`, {
    note: note || null,
    notify_admin: notifyAdmin,
  })
  return { company: data.data, adminsNotified: data.meta.admins_notified }
}

/**
 * "+ Add company". Returns the new company's card (active, no Admin yet).
 * 422 = a field is wrong, e.g. "A company with this name already exists."
 */
export async function createCompany(values) {
  const { data } = await apiClient.post('/superadmin/companies', values)
  return data.data
}

import { apiClient } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/**
 * The company's payees. { status: 'active'|'inactive', type: id|'none', search, sort, page }
 * Returns { payees, meta: { current_page, last_page, from, to, total, counts: { all, none, types: [{id,name,count}], active, inactive } } }
 */
export async function listPayees({ status, type, search, sort, page = 1, signal } = {}) {
  const { data } = await apiClient.get('/payees', { params: listParams({ status, type, search, sort, page }), signal })
  return { payees: data.data, meta: data.meta }
}

/** One payee with the side panel's numbers (your own vouchers) and recent vouchers. */
export async function getPayee(id) {
  const { data } = await apiClient.get(`/payees/${id}`)
  return data.data
}

/** 422 = field errors (incl. "already exists" on name / TIN). */
export async function createPayee(values) {
  const { data } = await apiClient.post('/payees', values)
  return data.data
}

/** `updatedAt` = the version the form opened: 409 PAYEE_CHANGED if someone saved in between. */
export async function updatePayee(id, values, updatedAt) {
  const { data } = await apiClient.patch(`/payees/${id}`, { ...values, updated_at: updatedAt })
  return data.data
}

export async function setPayeeActive(id, active) {
  const { data } = await apiClient.post(`/payees/${id}/${active ? 'reactivate' : 'deactivate'}`)
  return data.data
}

/** "Already on the list?" → [{ id, name, tin, type, is_active, reason: same_tin|same_name|similar_name }] */
export async function findSimilarPayees({ name, tin, ignore, signal }) {
  const { data } = await apiClient.get('/payees/similar', { params: { name: name || undefined, tin: tin || undefined, ignore }, signal })
  return data.data
}

/** Downloads the list as shown (same filters). format: 'csv' | 'xlsx'. */
export async function exportPayees({ format, status, type, search, sort }) {
  const response = await apiClient.get('/payees/export', {
    params: { ...listParams({ status, type, search, sort }), format },
    responseType: 'blob',
    validateStatus: () => true, // an error answer is a blob too; saveDownload reads it
  })
  return saveDownload(response, `payees.${format}`)
}

function listParams({ status, type, search, sort, page }) {
  const params = {}
  if (page) params.page = page
  if (status) params['filter[status]'] = status
  if (type) params['filter[type]'] = type
  if (search) params.search = search
  if (sort) params.sort = sort
  return params
}

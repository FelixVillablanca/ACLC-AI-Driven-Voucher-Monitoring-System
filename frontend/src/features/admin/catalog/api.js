import { apiClient } from '@/lib/apiClient'

/** All 3 lists of YOUR company at once: { categories, voucher_types, payee_types } (+ built-in categories). */
export async function getCatalog() {
  const { data } = await apiClient.get('/admin/catalog')
  return data.data
}

/** Add to a list. kind = 'categories' | 'voucher_types' | 'payee_types'. 422 = name / code already used. */
export async function createCatalogItem(kind, values) {
  const { data } = await apiClient.post(`/admin/catalog/${kind}`, values)
  return data.data
}

/** Edit. Send the item's `updated_at` from when the form opened (409 CATALOG_CHANGED if someone saved it meanwhile). */
export async function updateCatalogItem(kind, id, values, updatedAt) {
  const { data } = await apiClient.patch(`/admin/catalog/${kind}/${id}`, { ...values, updated_at: updatedAt })
  return { item: data.data, changed: data.meta?.changed ?? [] }
}

/** Delete. 409 CATALOG_IN_USE = vouchers use it (rename it, or deactivate a category instead). */
export async function deleteCatalogItem(kind, id) {
  await apiClient.delete(`/admin/catalog/${kind}/${id}`)
}

/** Categories only: deactivate / reactivate. 409 = already in that state. */
export async function setCategoryActive(id, active) {
  const { data } = await apiClient.post(`/admin/catalog/categories/${id}/${active ? 'reactivate' : 'deactivate'}`)
  return data.data
}

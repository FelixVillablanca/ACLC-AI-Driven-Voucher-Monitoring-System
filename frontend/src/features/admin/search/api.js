import { apiClient } from '@/lib/apiClient'

/**
 * Top-bar search (GET /api/v1/admin/search?q=).
 * The server only looks inside the Admin's own company: its users and departments.
 * `signal` lets us cancel an older request when the Admin keeps typing.
 */
export async function searchAdminScope(q, { signal } = {}) {
  const { data } = await apiClient.get('/admin/search', { params: { q }, signal })
  return { ...data.data, meta: data.meta }
}

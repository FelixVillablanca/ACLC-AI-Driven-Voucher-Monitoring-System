import { apiClient } from '@/lib/apiClient'

/** The admin dashboard numbers (GET /api/v1/admin/dashboard). */
export async function getAdminDashboard() {
  const { data } = await apiClient.get('/admin/dashboard')
  return data.data
}

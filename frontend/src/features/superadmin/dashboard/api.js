import { apiClient, BACKGROUND } from '@/lib/apiClient'

/**
 * The Super Admin landing-page numbers (GET /api/v1/superadmin/dashboard).
 * `background: true` for the every-minute refresh, so it doesn't keep the session alive.
 */
export async function getSuperAdminDashboard({ background = false } = {}) {
  const { data } = await apiClient.get('/superadmin/dashboard', background ? BACKGROUND : undefined)
  return data.data
}

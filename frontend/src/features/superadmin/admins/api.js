import { apiClient } from '@/lib/apiClient'

/** Before saving: { employee_id: "EMP-2026-0007" (preview only), companies: [{ id, name, admins_count }] } */
export async function getAdminFormDefaults() {
  const { data } = await apiClient.get('/superadmin/admins/form-defaults')
  return data.data
}

/**
 * Creates an Admin. Returns { admin, invitationSent } (false = the email couldn't be sent).
 * Throws an ApiError (422 = field errors to show under the inputs).
 */
export async function createAdmin(values) {
  const { data } = await apiClient.post('/superadmin/admins', values)
  return { admin: data.data, invitationSent: Boolean(data.meta?.invitation_sent) }
}

/** Sends a NEW set-password link (the old one stops working). Returns the address it went to. */
export async function resendInvitation(adminId) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/invitation`)
  return data.data.sent_to
}

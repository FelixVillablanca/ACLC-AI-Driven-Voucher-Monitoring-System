import { apiClient } from '@/lib/apiClient'

/**
 * One page of the Admin accounts table (Framer bxGFPLOVN).
 *   { status, role, search, page }: status 'active'|'pending'|'inactive', role 'admin'|'super_admin'
 * Returns { accounts, meta: { current_page, last_page, from, to, total, counts, total_accounts, super_admin_seats } }
 */
export async function listAdmins({ status, role, search, page = 1 } = {}) {
  const params = { page }
  if (status) params['filter[status]'] = status
  if (role) params['filter[role]'] = role
  if (search) params.search = search
  const { data } = await apiClient.get('/superadmin/admins', { params })
  return { accounts: data.data, meta: data.meta }
}

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

/** Lock an Admin's account. Needs the Super Admin's own password (422 on `password` if wrong). */
export async function lockAdminAccount(adminId, { password, alertId }) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/lock`, {
    password,
    security_alert_id: alertId ?? null,
  })
  return data.data
}

export async function unlockAdminAccount(adminId) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/unlock`)
  return data.data
}

/** Emails a 60-minute "choose a new password" link. Returns the address it went to. */
export async function resetAdminPassword(adminId, { alertId } = {}) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/password-reset`, {
    security_alert_id: alertId ?? null,
  })
  return data.data.sent_to
}

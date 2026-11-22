import { apiClient } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/**
 * One page of the Admins table (Framer U7glXUOSF).
 *   { view, search, sort, order, page }: view 'super_admins'|'admins'|'pending'|'inactive' (none = All)
 * Returns { accounts, meta: { current_page, last_page, from, to, total, views, summary } }
 */
export async function listAdmins({ view, search, sort, order, page = 1 } = {}) {
  const params = { page }
  if (view) params['filter[view]'] = view
  if (search) params.search = search
  if (sort) params.sort = sort
  if (order) params.order = order
  const { data } = await apiClient.get('/superadmin/admins', { params })
  return { accounts: data.data, meta: data.meta }
}

/** Everything the profile panel / Edit / Make Super Admin need (A8, A9, A12). */
export async function getAdmin(id) {
  const { data } = await apiClient.get(`/superadmin/admins/${id}`)
  return data.data
}

/** What they did, newest first (profile "Activity" tab). Returns { items, meta } */
export async function getAdminActivity(id, page = 1) {
  const { data } = await apiClient.get(`/superadmin/admins/${id}/activity`, { params: { page } })
  return { items: data.data, meta: data.meta }
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

/** Edit details (A9). Returns { admin, changed: ['email', …], invitationResent: true|false|null } */
export async function updateAdmin(id, values) {
  const { data } = await apiClient.patch(`/superadmin/admins/${id}`, values)
  return { admin: data.data, changed: data.meta?.changed ?? [], invitationResent: data.meta?.invitation_resent ?? null }
}

/** Sends a NEW set-password link (the old one stops working). Returns the address it went to. */
export async function resendInvitation(adminId) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/invitation`)
  return data.data.sent_to
}

/** Cancel invite (A5): deletes the never-used account. */
export async function cancelInvitation(adminId) {
  await apiClient.delete(`/superadmin/admins/${adminId}/invitation`)
}

/**
 * Emails a 60-minute "choose a new password" link (A10). Returns the address it went to.
 * signOut (default true) = the old password stops working and they're signed out everywhere now.
 */
export async function resetAdminPassword(adminId, { alertId, signOut = true } = {}) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/password-reset`, {
    security_alert_id: alertId ?? null,
    sign_out: signOut,
  })
  return data.data.sent_to
}

/** Require two-step sign-in (A11). Returns { setup_deadline, emailed, sent_to } */
export async function requireTwoFactor(adminId, { setupDays, emailSteps }) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/two-factor`, {
    setup_days: setupDays,
    email_steps: emailSteps,
  })
  return data.data
}

/** Deactivate an account. Needs the Super Admin's own password (422 on `password` if wrong). */
export async function deactivateAccount(adminId, { password, alertId }) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/deactivate`, {
    password,
    security_alert_id: alertId ?? null,
  })
  return data.data
}

export async function reactivateAccount(adminId) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/reactivate`)
  return data.data
}

/** Make Super Admin (A12). Needs the password; 409 when a check fails. */
export async function promoteToSuperAdmin(adminId, { password }) {
  const { data } = await apiClient.post(`/superadmin/admins/${adminId}/promote`, { password })
  return data.data
}

/**
 * The "2 selected" bar (A6). action: 'password_reset' | 'require_two_factor' | 'deactivate'
 * Returns { results: [{ id, name, ok, message }], done, skipped }
 */
export async function bulkAdminAction({ action, ids, password, setupDays, emailSteps, signOut }) {
  const { data } = await apiClient.post('/superadmin/admins/bulk', {
    action,
    ids,
    password,
    setup_days: setupDays,
    email_steps: emailSteps,
    sign_out: signOut,
  })
  return { results: data.data, done: data.meta.done, skipped: data.meta.skipped }
}

/**
 * Export (A1): downloads a .csv or .pdf. The file comes back as a "blob" (raw bytes).
 * Every status is accepted here (validateStatus), because an error reply would ALSO arrive as a
 * blob: it's read back as JSON so the real message ("Tick at least one thing…") can be shown.
 */
export async function exportAdmins({ format, accounts, view, search, ids, columns }) {
  const response = await apiClient.get('/superadmin/admins/export', {
    params: { format, accounts, 'filter[view]': view || undefined, search: search || undefined, ids, columns },
    responseType: 'blob',
    validateStatus: () => true,
  })
  return saveDownload(response, `admin-list.${format}`)
}

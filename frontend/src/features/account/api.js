import { apiClient } from '@/lib/apiClient'

/**
 * The account menu pages talk to /api/v1/account/*. Every call works on YOUR OWN account
 * (there is no id in the address). Each function returns plain data or throws an ApiError.
 */

/** Profile + security summary (My profile, Account settings). */
export async function getAccount() {
  const { data } = await apiClient.get('/account')
  return data.data
}

/**
 * Saves changed profile fields. `was` = the values the screen showed (409 PROFILE_CHANGED if they changed meanwhile).
 * current_password only when the personal email changes. Returns the fresh account.
 */
export async function updateProfile({ changes, was, currentPassword }) {
  const body = { ...changes, was }
  if (currentPassword) body.current_password = currentPassword
  const { data } = await apiClient.patch('/account', body)
  return data.data
}

/** Returns { other_sessions_signed_out } */
export async function changePassword({ currentPassword, password, passwordConfirmation }) {
  const { data } = await apiClient.put('/account/password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  })
  return data.data
}

/** The QR code (an <svg> made by our server) and the key to type by hand. */
export async function getTwoFactorSetup() {
  const { data } = await apiClient.get('/account/two-factor/setup')
  return data.data
}

/** Returns { account, recoveryCodes } (the codes are shown ONCE). */
export async function enableTwoFactor(code) {
  const { data } = await apiClient.post('/account/two-factor', { code })
  return { account: data.data, recoveryCodes: data.meta.recovery_codes }
}

export async function renewRecoveryCodes(password) {
  const { data } = await apiClient.post('/account/two-factor/recovery-codes', { password })
  return data.data.recovery_codes
}

/** Returns the fresh account. 403 TWO_FACTOR_REQUIRED when something requires it. */
export async function disableTwoFactor(password) {
  const { data } = await apiClient.delete('/account/two-factor', { data: { password } })
  return data.data
}

/** [{ key, device, ip, last_active_at, current }] */
export async function listSessions() {
  const { data } = await apiClient.get('/account/sessions')
  return data.data
}

export async function signOutSession(key) {
  await apiClient.delete(`/account/sessions/${key}`)
}

/** Returns how many were signed out. */
export async function signOutOtherSessions() {
  const { data } = await apiClient.post('/account/sessions/sign-out-others')
  return data.data.signed_out
}

/** { data: [...entries], meta: { current_page, last_page, total }, summary } */
export async function getActivity({ type = 'all', page = 1 } = {}) {
  const { data } = await apiClient.get('/account/activity', { params: { type, page } })
  return data
}

/** { contacts: [{ name, email, role }], request_id } */
export async function getSupport() {
  const { data } = await apiClient.get('/account/support')
  return data.data
}

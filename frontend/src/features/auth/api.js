import { apiClient } from '@/lib/apiClient'

/**
 * Every auth call to the backend lives here (the only file in this feature that
 * talks to apiClient). Each function returns plain data or throws an ApiError.
 */

// /sanctum/csrf-cookie lives at the server root, not under /api/v1
const serverRoot = () => new URL(apiClient.defaults.baseURL, window.location.origin).origin

/**
 * CSRF cookie = an anti-forgery token. Laravel only accepts the login form if
 * the browser first picked up this cookie, which proves the request comes from
 * OUR app and not from a fake site.
 */
export async function getCsrfCookie() {
  await apiClient.get('/sanctum/csrf-cookie', { baseURL: serverRoot() })
}

/**
 * Logs in. Returns EITHER the user (with role and companies),
 * OR { two_factor: { stage: 'challenge' | 'setup', email, can_skip, setup_deadline } }
 * when two-step sign-in still has to happen (the person is NOT signed in yet).
 */
export async function login({ email, password, remember }) {
  await getCsrfCookie()
  const { data } = await apiClient.post('/auth/login', { email, password, remember })
  return data.data
}

/** The 6-digit code (or one backup code). Returns the signed-in user. 401 TWO_FACTOR_EXPIRED = start again. */
export async function verifyTwoFactor({ code, recoveryCode }) {
  const body = recoveryCode ? { recovery_code: recoveryCode } : { code }
  const { data } = await apiClient.post('/auth/two-factor/challenge', body)
  return data.data
}

/** The QR code to scan (an <svg> made by our server) and the key to type by hand. */
export async function getTwoFactorSetup() {
  const { data } = await apiClient.get('/auth/two-factor/setup')
  return data.data
}

/** Confirms the setup with the first code. Returns { user, recoveryCodes } (the codes are shown ONCE). */
export async function confirmTwoFactorSetup(code) {
  const { data } = await apiClient.post('/auth/two-factor/setup', { code })
  return { user: data.data, recoveryCodes: data.meta.recovery_codes }
}

/** "Set up later" (only while the setup window is open). Returns the signed-in user. */
export async function skipTwoFactorSetup() {
  const { data } = await apiClient.post('/auth/two-factor/skip')
  return data.data
}

/** "Back to sign in": forget the half-finished sign-in. */
export async function cancelTwoFactor() {
  await apiClient.post('/auth/two-factor/cancel')
}

/** "Who am I?" Returns the logged-in user, or throws a 401 ApiError for guests. */
export async function me() {
  const { data } = await apiClient.get('/auth/me')
  return data.data
}

export async function logout() {
  await apiClient.post('/auth/logout')
}

/** Is this "set your password" link still valid? Returns { first_name, email }; 410 = expired or used. */
export async function checkInvitation({ email, token }) {
  await getCsrfCookie()
  const { data } = await apiClient.post('/auth/invitation/check', { email, token })
  return data.data
}

/** Saves the new password from the invitation link (the link then stops working). */
export async function acceptInvitation({ email, token, password, password_confirmation }) {
  await getCsrfCookie()
  await apiClient.post('/auth/invitation/accept', { email, token, password, password_confirmation })
}

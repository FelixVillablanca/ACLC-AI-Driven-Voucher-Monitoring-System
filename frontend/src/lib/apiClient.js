import axios from 'axios'
import toast from 'react-hot-toast'
import { normalizeApiError } from '@/lib/apiError'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

/**
 * THE ONE MESSENGER between React and the Laravel API.
 * Rule: only features/<x>/api.js files import this. Components never call Axios directly.
 *
 *   import { apiClient } from '@/lib/apiClient'
 *   const { data } = await apiClient.get('/health')
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 20000, // give up after 20 seconds instead of spinning forever
  withCredentials: true, // send the login cookie (Sanctum, Phase 1)
  withXSRFToken: true, // send the CSRF security token (Sanctum, Phase 1)
  headers: { Accept: 'application/json' },
})

/**
 * Add to a request that the APP makes on a timer (not the person), e.g. polling every minute:
 *   apiClient.get('/notifications/unread-count', BACKGROUND)
 * The server then doesn't count it as activity, so the Super Admin idle timeout still works.
 */
export const BACKGROUND = Object.freeze({ headers: { 'X-Background-Refresh': '1' } })

/** Codes meaning "the server has signed you out" (the message explains why). */
const SIGNED_OUT_CODES = ['SESSION_EXPIRED', 'COMPANY_SUSPENDED', 'ACCOUNT_INACTIVE', 'TWO_FACTOR_SETUP_REQUIRED']

// BEFORE every request: attach the active company and a duplicate-guard key
apiClient.interceptors.request.use((config) => {
  const companyId = useCompanyStore.getState().activeCompanyId
  if (companyId) config.headers['X-Company-ID'] = companyId

  // Idempotency-Key (Phase 7 step 1, 2026-11-28): the SAME key when the same POST (address + company + body) is sent
  // again within 10 s, e.g. a double-click; the server then answers the second one with the first one's result
  // (backend EnsureIdempotency) instead of doing the work twice. A different request always gets a new key.
  if (config.method === 'post' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = idempotencyKeyFor(config, companyId)
  }
  return config
})

const REPEAT_WINDOW_MS = 10_000
const recentPosts = new Map() // signature → { key, at }

function idempotencyKeyFor(config, companyId) {
  const body = config.data
  // uploads (FormData) can't be compared cheaply: each gets its own key
  if (typeof FormData !== 'undefined' && body instanceof FormData) return crypto.randomUUID()
  const signature = `${config.url}|${companyId ?? ''}|${typeof body === 'string' ? body : JSON.stringify(body ?? null)}`
  const now = Date.now()
  for (const [sig, entry] of recentPosts) if (now - entry.at > REPEAT_WINDOW_MS) recentPosts.delete(sig)
  const hit = recentPosts.get(signature)
  if (hit) return hit.key
  const key = crypto.randomUUID()
  recentPosts.set(signature, { key, at: now })
  return key
}

// AFTER every response: turn any error into our simple ApiError shape
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = normalizeApiError(error)

    // The login form shows its own errors, so only handle sessions that were already open
    const isLogin = /\/auth\/(login|invitation\/|two-factor\/)/.test(error.config?.url ?? '')

    // Signed out by the server (idle too long, company suspended, account deactivated):
    // forget the user, and SAY WHY, instead of silently dropping them on the login page.
    if (!isLogin && SIGNED_OUT_CODES.includes(apiError.code)) {
      useCompanyStore.getState().clear()
      useAuthStore.getState().clear()
      toast.error(apiError.message, { id: 'signed-out', duration: 8000 })
    } else if (apiError.status === 401) {
      // Session ended / not logged in -> forget the user; route guards send them to /login
      useAuthStore.getState().clear()
    }

    return Promise.reject(apiError)
  },
)

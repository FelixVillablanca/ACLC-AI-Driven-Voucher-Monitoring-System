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
const SIGNED_OUT_CODES = ['SESSION_EXPIRED', 'COMPANY_SUSPENDED', 'ACCOUNT_INACTIVE']

// BEFORE every request: attach the active company and a duplicate-guard key
apiClient.interceptors.request.use((config) => {
  const companyId = useCompanyStore.getState().activeCompanyId
  if (companyId) config.headers['X-Company-ID'] = companyId

  // Idempotency-Key: a unique ID per POST, so a double-click can't create two records
  if (config.method === 'post' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = crypto.randomUUID()
  }
  return config
})

// AFTER every response: turn any error into our simple ApiError shape
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = normalizeApiError(error)

    // The login form shows its own errors, so only handle sessions that were already open
    const isLogin = /\/auth\/(login|invitation\/)/.test(error.config?.url ?? '')

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

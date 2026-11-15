import axios from 'axios'
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

    // Session expired / not logged in -> forget the user; route guards send them to /login
    if (apiError.status === 401) useAuthStore.getState().clear()

    return Promise.reject(apiError)
  },
)

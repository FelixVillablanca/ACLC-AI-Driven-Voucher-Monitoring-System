import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { logout, me } from './api'

/**
 * Which company should be active after login?
 *   1. the one picked last time, if the user still has access to it
 *   2. otherwise their home company, if they have access to it
 *   3. otherwise the first company they have access to
 *   4. none (admins, or users who haven't been given access yet)
 */
export function chooseActiveCompany(user, currentId) {
  const ids = (user.companies ?? []).map((company) => company.id)
  if (currentId && ids.includes(currentId)) return currentId
  if (user.company?.id && ids.includes(user.company.id)) return user.company.id
  return ids[0] ?? null
}

/** Save the logged-in user in the global stores (auth + active company). */
export function startSession(user) {
  const companyStore = useCompanyStore.getState()
  companyStore.setActiveCompany(chooseActiveCompany(user, companyStore.activeCompanyId))
  useAuthStore.getState().setUser(user)
}

/**
 * Ask the server "am I still logged in?" (runs on app start, and on Retry).
 * 401 -> guest (the apiClient already cleared the store).
 * Anything else (server off, no internet) -> error state with a Retry button.
 */
export async function restoreSession() {
  useAuthStore.getState().setChecking()
  try {
    startSession(await me())
  } catch (error) {
    if (error.status === 401) useAuthStore.getState().clear()
    else useAuthStore.getState().setError(error)
  }
}

/**
 * Sign out: end the session on the server, then forget the user in the browser.
 * If the server can't be reached, the error is thrown so the screen can show it,
 * and the user stays signed in (otherwise a page refresh would quietly sign them back in).
 */
export async function signOut() {
  try {
    await logout()
  } catch (error) {
    if (error.status !== 401) throw error // 401 = the session had already ended: that's fine
  }
  useCompanyStore.getState().clear()
  useAuthStore.getState().clear() // the route guards now send them to /login
}

/**
 * Reload the signed-in user quietly (no loading screen), e.g. after joining another company,
 * so the company switcher lists the new company. Keeps the active company.
 */
export async function refreshUser() {
  const user = await me()
  useAuthStore.getState().setUser(user)
  return user
}

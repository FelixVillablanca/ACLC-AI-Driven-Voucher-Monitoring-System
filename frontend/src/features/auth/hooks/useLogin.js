import { useCallback } from 'react'
import { login } from '../api'
import { startSession } from '../utils'

/**
 * Returns a function that logs in and saves the session.
 *   → { user }       signed in
 *   → { twoFactor }  the password was right, but two-step sign-in comes next (NOT signed in yet)
 * Errors are thrown (as ApiError) so the form can show them under the fields.
 */
export function useLogin() {
  return useCallback(async (values) => {
    const result = await login(values)
    if (result.two_factor) return { twoFactor: result.two_factor }
    startSession(result)
    return { user: result }
  }, [])
}

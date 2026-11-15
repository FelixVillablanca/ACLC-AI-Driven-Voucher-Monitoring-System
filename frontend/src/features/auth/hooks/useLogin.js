import { useCallback } from 'react'
import { login } from '../api'
import { startSession } from '../utils'

/**
 * Returns a function that logs in and saves the session.
 * Errors are thrown (as ApiError) so the form can show them under the fields.
 */
export function useLogin() {
  return useCallback(async (values) => {
    const user = await login(values)
    startSession(user)
    return user
  }, [])
}

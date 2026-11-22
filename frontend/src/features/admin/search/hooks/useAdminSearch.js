import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { searchAdminScope } from '../api'

export const MIN_LENGTH = 2

const EMPTY = []

/**
 * Asks the server as the Admin types (debounced 300 ms).
 * status: 'idle' (fewer than 2 letters) | 'loading' | 'success' | 'error'
 * An older answer that arrives late is thrown away (AbortController), so the list
 * always matches what's in the box. The answer is saved WITH the words it answers,
 * so "loading" simply means "the saved answer is for different words".
 */
export function useAdminSearch(text) {
  const term = useDebounce(text.trim(), 300)
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState({ key: null, status: 'success', users: EMPTY, departments: EMPTY, error: null })
  const key = `${attempt}|${term}`
  const searching = term.length >= MIN_LENGTH

  useEffect(() => {
    if (!searching) return undefined
    const controller = new AbortController()

    searchAdminScope(term, { signal: controller.signal })
      .then(({ users, departments }) => setAnswer({ key, status: 'success', users, departments, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setAnswer({ key, status: 'error', users: EMPTY, departments: EMPTY, error })
      })

    return () => controller.abort()
  }, [key, term, searching])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (!searching) return { status: 'idle', users: EMPTY, departments: EMPTY, error: null, term, retry }
  if (answer.key !== key) return { status: 'loading', users: EMPTY, departments: EMPTY, error: null, term, retry }
  return { ...answer, term, retry }
}

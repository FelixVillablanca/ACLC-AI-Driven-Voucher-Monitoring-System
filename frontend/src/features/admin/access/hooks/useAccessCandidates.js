import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { listAccessCandidates } from '../api'

/**
 * The "Grant company access" list. Searches 300 ms after typing stops; an older answer
 * that arrives late is thrown away. The answer is saved with the words it answers, so
 * "loading" = "the saved answer is for something else".
 */
export function useAccessCandidates(text) {
  const search = useDebounce(text.trim(), 300)
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState({ key: null, status: 'success', people: [], meta: null, error: null })
  const key = `${attempt}|${search}`

  useEffect(() => {
    const controller = new AbortController()
    listAccessCandidates({ search, signal: controller.signal })
      .then(({ people, meta }) => setAnswer({ key, status: 'success', people, meta, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setAnswer({ key, status: 'error', people: [], meta: null, error })
      })
    return () => controller.abort()
  }, [key, search])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  if (answer.key !== key) return { status: 'loading', people: [], meta: answer.meta, error: null, search, reload }
  return { ...answer, search, reload }
}

import { useEffect, useState } from 'react'

/**
 * DEBOUNCE = wait until the value stops changing for `delay` ms, then pass it on.
 * Used for search boxes: typing "liza" asks the server once, not 4 times.
 *   const debounced = useDebounce(text, 300)
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

import { useEffect } from 'react'

const BASE = 'ADVMS'

/**
 * Sets the browser tab title while a page is open: "Review queue · ADVMS" (polish 2026-11-27).
 * `title` may be empty while a detail page loads: the tab then shows just "ADVMS".
 */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : BASE
  }, [title])
  useEffect(() => () => void (document.title = BASE), [])
}

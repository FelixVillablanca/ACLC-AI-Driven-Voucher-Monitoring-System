import { useEffect } from 'react'

/**
 * Closes a dropdown when you click outside it or press Esc.
 *   const ref = useRef(null)
 *   useDismiss(open, ref, () => setOpen(false))
 *   <div ref={ref}>…button + menu…</div>
 */
export function useDismiss(open, ref, onDismiss) {
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !ref.current?.contains(e.target) && onDismiss()
    const onKey = (e) => e.key === 'Escape' && onDismiss()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref, onDismiss])
}

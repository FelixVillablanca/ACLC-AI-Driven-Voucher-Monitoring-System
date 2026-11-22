import { useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * The shared centred modal (Framer: 14px radius, header with title + ✕, Muted footer inside `children`).
 * Esc and ✕ close it. A click on the dark backdrop closes it too, unless `keepOpenOnBackdrop`
 * (set it while the form has unsaved typing, so nothing is lost by accident).
 * Put it inside <AnimatePresence> so it fades in and out.
 *   <ModalShell title="Add department" subtitle="…" width={560} onClose={close}>…body + footer…</ModalShell>
 */
export default function ModalShell({ title, subtitle, width = 600, onClose, keepOpenOnBackdrop = false, children }) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && !keepOpenOnBackdrop && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-16"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ width }}
        className="flex max-h-[calc(100dvh-2rem)] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="text-page-title">
              {title}
            </h2>
            {subtitle && <p className="text-body text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

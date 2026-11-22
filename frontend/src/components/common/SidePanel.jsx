import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * A panel that slides in from the right over a dark backdrop (the Super Admin "side panel"
 * pattern: profile, company, change history, event details, jobs, incidents).
 * Esc or a click on the backdrop closes it. Render it inside <AnimatePresence> while open.
 *
 *   <SidePanel label="Background jobs" width={480} onClose={…} footer={<buttons/>}>
 *     …header + body…
 *   </SidePanel>
 */
export default function SidePanel({ label, width = 480, onClose, footer, children }) {
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
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-foreground/45"
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ '--panel-w': `${width}px` }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl sm:w-(--panel-w)"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted px-6 py-3.5">{footer}</footer>}
      </motion.aside>
    </motion.div>
  )
}

/** The ✕ in a panel's header. */
export function PanelClose({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}

import { X } from 'lucide-react'

/** The ✕ in the top-right corner of both panels. */
export default function PanelCloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}

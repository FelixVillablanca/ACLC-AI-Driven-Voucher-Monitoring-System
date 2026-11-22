import { useCallback, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useDismiss } from '@/hooks/useDismiss'
import { cn } from '@/lib/utils'

/**
 * A filter button ("All companies ▾") with its dropdown panel and a Cancel / Apply footer
 * (AL3, AL4, AL5). The panel's choices are a DRAFT until Apply, so Cancel changes nothing.
 *   label, active (tinted Primary Soft when a filter is set), width, align ('left' | 'right')
 *   children({ close }) renders the panel body; footer({ close }) the buttons.
 */
export default function FilterMenu({ label, active, width = 300, align = 'left', onOpen, children, footer }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((v) => !v)
        }}
        className={cn(
          'flex h-[38px] items-center gap-2 rounded-lg border px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          active || open ? 'text-badge border-primary bg-primary-soft text-primary' : 'text-body bg-card hover:bg-muted',
        )}
      >
        <span className="max-w-[180px] truncate">{label}</span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={cn(
            'absolute top-full z-30 mt-1.5 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children({ close })}
          <div className="flex items-center justify-end gap-2 border-t bg-muted px-3.5 py-2.5">{footer({ close })}</div>
        </div>
      )}
    </div>
  )
}

/** The two footer buttons every filter panel uses. */
export function MenuFooter({ onCancel, onApply, applyLabel = 'Apply', disabled }) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="text-body-strong h-8 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled}
        className="text-auth-button h-8 rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {applyLabel}
      </button>
    </>
  )
}

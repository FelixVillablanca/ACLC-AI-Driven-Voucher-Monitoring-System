import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The 16px checkbox square used in the filter panels (a real checkbox underneath). */
export default function CheckBox({ checked, onChange, label, children, className }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5', className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

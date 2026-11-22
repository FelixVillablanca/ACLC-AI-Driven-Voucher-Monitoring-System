import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A checkbox with a bold title and a caption under it ("Watch it for 24 hours"). */
export default function CheckBoxRow({ checked, onChange, title, caption }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3.5 py-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span>
        <span className="text-body-strong block text-foreground">{title}</span>
        <span className="text-caption">{caption}</span>
      </span>
    </label>
  )
}

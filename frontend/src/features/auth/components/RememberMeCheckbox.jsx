import { Check } from 'lucide-react'

/**
 * "Keep me signed in for 30 days" (Framer: 18px Primary box, 5px radius).
 * A real <input type="checkbox"> stays underneath (visually hidden), so the
 * keyboard (Space) and screen readers work like any normal checkbox.
 */
export default function RememberMeCheckbox({ label, ref, ...inputProps }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input ref={ref} type="checkbox" className="peer sr-only" {...inputProps} />
      <span
        aria-hidden="true"
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border bg-card text-primary-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className="text-body">{label}</span>
    </label>
  )
}

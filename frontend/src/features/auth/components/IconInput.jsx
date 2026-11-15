import { cn } from '@/lib/utils'

/**
 * A 44px input with an icon on the left and an optional slot on the right
 * (Framer: the "Work email" / "Password" fields).
 * The border turns Primary when focused and Danger when there's an error.
 */
export default function IconInput({ icon: Icon, invalid, trailing, className, ref, ...inputProps }) {
  return (
    <div
      className={cn(
        'flex h-11 w-full items-center gap-2.5 rounded-[10px] border bg-card px-3.5 transition-colors',
        'focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger',
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className="text-body h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        {...inputProps}
      />
      {trailing}
    </div>
  )
}

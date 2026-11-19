/** Shared input/select look (Framer: 40px tall, 8px radius, Primary border on focus, Danger on error). */
export const inputClass =
  'text-body h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-[0.5px] focus:ring-primary aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'

/**
 * Label (+ red * when required) above an input, and the error message below it.
 * The input itself is passed as children.
 */
export default function FieldShell({ id, label, required, error, hint, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-label flex items-center gap-0.5">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-caption">{hint}</p>
      )}
    </div>
  )
}


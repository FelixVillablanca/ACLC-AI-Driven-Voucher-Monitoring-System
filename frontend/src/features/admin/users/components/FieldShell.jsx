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


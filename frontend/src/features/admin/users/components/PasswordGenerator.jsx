import { Copy, KeyRound, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * "Sign-in password" card (replaces the old invitation row, 2026-11-16).
 * The password is generated for the admin (read-only, so it's always strong):
 * "Generate new" makes another one, "Copy" puts it on the clipboard to hand over.
 */
export default function PasswordGenerator({ value, onGenerate, error, disabled }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Password copied')
    } catch {
      toast.error("Couldn't copy automatically. Select the password and copy it by hand.")
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] border bg-muted px-3.5 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <KeyRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="password-label" className="text-body-strong">
            Sign-in password
          </p>
          <p className="text-caption">Generated automatically. Give it to the user so they can sign in.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="password"
            readOnly
            value={value}
            aria-labelledby="password-label"
            aria-invalid={error ? true : undefined}
            onFocus={(e) => e.target.select()}
            className="h-[38px] w-[170px] rounded-lg border bg-card px-3 text-center font-mono text-sm tracking-wider outline-none focus:border-primary aria-invalid:border-danger"
          />
          <button
            type="button"
            onClick={copy}
            disabled={disabled || !value}
            title="Copy password"
            aria-label="Copy password"
            className="flex size-[38px] items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Copy className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Generate new
          </button>
        </div>
      </div>
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  )
}

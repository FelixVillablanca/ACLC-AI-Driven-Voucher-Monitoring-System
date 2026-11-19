import { ROLE_EMAIL_DOMAINS } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * "Email address" = [ name you type ][ @Clerk.com ]   (rule set 2026-11-16)
 * The domain on the right comes from the chosen ROLE and can't be edited.
 * Typing or pasting "@" keeps only the part before it ("maria@x.com" -> "maria").
 */
export default function EmailNameField({ role, registration, value, error, disabled }) {
  const domain = ROLE_EMAIL_DOMAINS[role]
  const fullEmail = value ? `${value}@${domain}` : null

  const onChange = (event) => {
    event.target.value = event.target.value.split('@')[0].replace(/\s/g, '').toLowerCase()
    registration.onChange(event)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="email_username" className="text-label flex items-center gap-0.5">
        Email address
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      </label>

      <div
        className={cn(
          'flex h-10 w-full min-w-0 overflow-hidden rounded-lg border bg-card transition-colors focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary',
          error && 'border-danger focus-within:border-danger focus-within:ring-danger',
          disabled && 'bg-muted',
        )}
      >
        <input
          id="email_username"
          {...registration}
          onChange={onChange}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. maria.santos"
          aria-invalid={error ? true : undefined}
          aria-describedby="email_username-help"
          className="text-body h-full min-w-0 flex-1 bg-transparent px-3 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <span
          title="Set by the role. It can't be changed."
          className="text-body-strong flex shrink-0 items-center border-l bg-muted px-3 text-muted-foreground select-none"
        >
          @{domain}
        </span>
      </div>

      {error ? (
        <p id="email_username-help" className="text-caption text-danger">
          {error}
        </p>
      ) : (
        <p id="email_username-help" className="text-caption truncate">
          {fullEmail ? (
            <>
              Signs in as <span className="font-medium text-foreground">{fullEmail}</span>
            </>
          ) : (
            'The domain comes from the role and can’t be changed.'
          )}
        </p>
      )}
    </div>
  )
}

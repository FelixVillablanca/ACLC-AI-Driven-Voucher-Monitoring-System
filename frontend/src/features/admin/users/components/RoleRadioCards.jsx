import { cn } from '@/lib/utils'
import { ROLE_OPTIONS } from '../schemas'

/**
 * The 4 role cards (Framer: selected = Primary Faint background + 1.5px Primary border,
 * filled radio dot). Real radio inputs underneath, so ←/→ keys and screen readers work.
 */
export default function RoleRadioCards({ value, onChange, error }) {
  return (
    <fieldset aria-describedby={error ? 'role-error' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <legend className="text-table-head text-muted-foreground">
          Role <span className="text-danger">*</span>
        </legend>
        <p className="text-caption">Determines what this user can do in the voucher pipeline</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
        {ROLE_OPTIONS.map((role) => {
          const selected = value === role.value
          return (
            <label
              key={role.value}
              className={cn(
                'flex cursor-pointer flex-col gap-1.5 rounded-[10px] border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                selected ? 'border-[1.5px] border-primary bg-primary-faint' : 'bg-card hover:border-primary/40',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selected}
                  onChange={() => onChange(role.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 rounded-full bg-card',
                    selected ? 'border-[5px] border-primary' : 'border-[1.5px] border-border',
                  )}
                />
                <span className="text-body-strong">{role.label}</span>
              </span>
              <span className="text-caption">{role.description}</span>
            </label>
          )
        })}
      </div>

      {error && (
        <p id="role-error" className="text-caption mt-1.5 text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

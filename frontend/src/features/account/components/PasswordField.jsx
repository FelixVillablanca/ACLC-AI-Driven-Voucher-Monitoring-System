import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { cn } from '@/lib/utils'

/** A labelled password box with Show / Hide (40px app input, not the 46px sign-in one). */
export default function PasswordField({ id, label, error, hint, required = true, value, onChange, autoComplete, ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputClass, 'pr-10')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </FieldShell>
  )
}

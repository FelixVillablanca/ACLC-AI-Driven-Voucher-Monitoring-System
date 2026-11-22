import { cn } from '@/lib/utils'

/**
 * A money box with its currency sign inside (Framer: "₱ | 50,000.00", 40px tall).
 * It holds TEXT while you type; utils.normalizeMoney() turns it into "50000.00" for saving.
 */
export default function MoneyInput({ id, symbol, value, onChange, invalid, width = 200, label }) {
  return (
    <div
      style={{ width }}
      className={cn(
        'flex h-10 max-w-full items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary',
        invalid && 'border-danger',
      )}
    >
      <span className="text-body text-muted-foreground" aria-hidden="true">
        {symbol}
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="text-body-strong h-full min-w-0 flex-1 bg-transparent text-right outline-none"
      />
    </div>
  )
}

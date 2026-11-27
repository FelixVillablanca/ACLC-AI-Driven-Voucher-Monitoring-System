import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { compactMoney } from '@/features/budgets'

/**
 * Actual vs forecast bars (Framer GWmqqOmd7 / sjtX1kKqt). points = [{ label, kind: actual|current|forecast,
 * actual, predicted, lower, upper }]:
 *   actual    solid Primary (approved spending of a finished month)
 *   current   this month: solid part = approved so far, dashed part on top = the rest of its forecast
 *   forecast  dashed Primary Soft (or Danger when `dangerFrom` says the budget runs out), with a thin line
 *             showing the likely range (80%)
 * Value labels above the bars in compact money; exact amounts in the tooltip.
 */
export default function ForecastChart({ points, height = 170, danger = false, label }) {
  const max = Math.max(
    1,
    ...points.map((p) => Math.max(Number(p.actual ?? 0), Number(p.predicted ?? 0), Number(p.upper ?? 0) * (p.kind === 'forecast' ? 1 : 0))),
  )
  const pct = (v) => `${(Number(v ?? 0) / max) * 100}%`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1.5 rounded-lg bg-muted px-2 pt-6" style={{ height }} role="img" aria-label={label}>
        {points.map((p) => {
          const actual = Number(p.actual ?? 0)
          const predicted = Number(p.predicted ?? 0)
          const forecast = p.kind === 'forecast'
          const rest = p.kind === 'current' ? Math.max(0, predicted - actual) : 0
          const shown = forecast ? predicted : actual + rest
          const tip = forecast
            ? p.predicted
              ? `${p.label}: forecast ${formatMoney(p.predicted)} (likely ${formatMoney(p.lower)} – ${formatMoney(p.upper)})`
              : `${p.label}: no forecast`
            : p.kind === 'current'
              ? `${p.label}: ${formatMoney(p.actual)} approved so far${p.predicted ? `, forecast ${formatMoney(p.predicted)}` : ''}`
              : `${p.label}: ${formatMoney(p.actual)} approved`
          return (
            <div key={p.month} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={tip}>
              <span
                className={cn(
                  'text-[11px] tabular-nums whitespace-nowrap',
                  forecast ? (danger ? 'font-semibold text-danger' : 'font-semibold text-primary') : 'text-muted-foreground',
                )}
              >
                {shown > 0 ? compactMoney(shown) : ''}
              </span>
              {forecast && p.upper && Number(p.upper) > predicted && (
                <span
                  aria-hidden="true"
                  className={cn('absolute w-px', danger ? 'bg-danger/60' : 'bg-primary/50')}
                  style={{ bottom: pct(p.lower), height: `calc(${pct(p.upper)} - ${pct(p.lower)})` }}
                />
              )}
              <div className="flex w-full flex-col justify-end" style={{ height: pct(shown), minHeight: shown > 0 ? 3 : 0 }}>
                {rest > 0 && (
                  <div
                    className="w-full rounded-t-[3px] border-[1.5px] border-b-0 border-dashed border-primary bg-primary-soft"
                    style={{ height: `${(rest / shown) * 100}%` }}
                  />
                )}
                {forecast
                  ? predicted > 0 && (
                      <div
                        className={cn(
                          'h-full w-full rounded-t-[3px] border-[1.5px] border-b-0 border-dashed',
                          danger ? 'border-danger bg-danger-soft' : 'border-primary bg-primary-soft',
                        )}
                      />
                    )
                  : actual > 0 && <div className={cn('w-full flex-1 bg-primary', rest > 0 ? '' : 'rounded-t-[3px]')} />}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 px-2">
        {points.map((p) => (
          <span
            key={p.month}
            className={cn(
              'min-w-0 flex-1 text-center text-[11px]',
              p.kind === 'forecast' ? (danger ? 'font-semibold text-danger' : 'font-semibold text-primary') : 'text-muted-foreground',
              p.kind === 'current' && 'font-semibold text-foreground',
            )}
          >
            {p.label}
            {p.kind === 'forecast' ? ' ▨' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Company access": one checkbox chip per company (Framer lmhV2DJV1).
 *   selected  -> Primary Faint + Primary border + filled tick
 *   primary   -> always selected, can't be unticked, shows a "Primary" pill
 *   inactive  -> dashed and faded, can't be selected ("· Inactive")
 */
export default function CompanyAccessChips({ companies, selectedIds, primaryId, onToggle, error }) {
  const activeCount = companies.filter((c) => c.is_active).length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p id="company-access-label" className="text-label">
          Company access
        </p>
        <p className="text-caption">
          {selectedIds.length} of {activeCount} active {activeCount === 1 ? 'company' : 'companies'} selected
        </p>
      </div>

      <div role="group" aria-labelledby="company-access-label" className="flex flex-wrap items-center gap-2">
        {companies.map((company) => {
          const isPrimary = company.id === primaryId
          const checked = selectedIds.includes(company.id)
          const disabled = !company.is_active || isPrimary

          return (
            <label
              key={company.id}
              title={isPrimary ? 'The primary company always has access' : undefined}
              className={cn(
                'flex h-[34px] items-center gap-2 rounded-lg border px-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                !company.is_active && 'cursor-not-allowed border-dashed bg-muted opacity-55',
                company.is_active && checked && 'border-primary bg-primary-faint',
                company.is_active && !checked && 'cursor-pointer bg-card hover:border-primary/40',
                isPrimary && 'cursor-default',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(company.id)}
              />
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-[4px]',
                  checked ? 'bg-primary text-primary-foreground' : 'border-[1.5px] border-border bg-card',
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={checked ? 'text-body-strong' : 'text-body'}>
                {company.name}
                {!company.is_active && ' · Inactive'}
              </span>
              {isPrimary && <span className="text-badge rounded-full bg-primary-soft px-2 py-0.5 text-primary">Primary</span>}
            </label>
          )
        })}
      </div>

      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  )
}

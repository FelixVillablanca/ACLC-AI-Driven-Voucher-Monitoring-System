import { CheckCircle2, ChevronDown } from 'lucide-react'
import { inputClass } from '@/components/common/FieldShell'
import { cn } from '@/lib/utils'
import { KEYS, REVIEW_SLA_HOURS } from '../utils'
import LockedValue from './LockedValue'
import MoneyInput from './MoneyInput'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * Approval rules. Since 2026-11-28 (user decision) EVERY voucher needs the Supervisor / Manager's final approval
 * (step 2), shown as a locked row; the high-value threshold (₱) only MARKS vouchers "High value" for them and in the
 * queues, and the old "Send AI-flagged vouchers to step 2" switch is gone (flagged vouchers are marked "Flagged").
 * Also: the review SLA (hours), the budget sign-off limit (₱, Budgets 2026-11-27) and the locked
 * segregation-of-duties rule.
 *   field(key) → { id, value, edited, wasText, error, onChange }
 */
export default function ApprovalRulesCard({ field }) {
  const threshold = field(KEYS.THRESHOLD)
  const sla = field(KEYS.REVIEW_SLA)
  const signoff = field(KEYS.BUDGET_SIGNOFF)

  return (
    <SettingsCard id="approval" icon={CheckCircle2} title="Approval rules" caption="How vouchers are reviewed and approved.">
      <SettingRow
        id="every-voucher-step2"
        title="Supervisor / Manager final approval"
        caption="Every voucher Accounting approves goes to the Supervisor / Manager for the final approval."
      >
        <LockedValue>Every voucher</LockedValue>
      </SettingRow>

      <SettingRow
        id={threshold.id}
        title="High-value threshold"
        caption="Vouchers at or above this amount are marked “High value” for the Supervisor and in the review queues."
        edited={threshold.edited}
        wasText={threshold.wasText}
        error={threshold.error}
      >
        <MoneyInput id={threshold.id} symbol="₱" value={threshold.value} onChange={threshold.onChange} invalid={Boolean(threshold.error)} />
      </SettingRow>

      <SettingRow
        id={sla.id}
        title="Accounting reviews within"
        caption="Vouchers waiting longer show ⏱ in the review queue (a warning; nothing is blocked)."
        edited={sla.edited}
        wasText={sla.wasText}
      >
        <div className="relative w-[150px]">
          <select
            id={sla.id}
            value={sla.value}
            onChange={(e) => sla.onChange(Number(e.target.value))}
            className={cn(inputClass, 'appearance-none pr-8')}
          >
            {REVIEW_SLA_HOURS.map((h) => (
              <option key={h} value={h}>
                {h} hours
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </SettingRow>

      <SettingRow
        id={signoff.id}
        title="Budget changes need sign-off above"
        caption="An Accounting Officer’s edit to a department budget bigger than this waits for a Supervisor / Manager."
        edited={signoff.edited}
        wasText={signoff.wasText}
        error={signoff.error}
      >
        <MoneyInput id={signoff.id} symbol="₱" value={signoff.value} onChange={signoff.onChange} invalid={Boolean(signoff.error)} />
      </SettingRow>

      <SettingRow
        id="self-approval"
        title="Approving your own voucher"
        caption="Built-in rule (segregation of duties). It can’t be turned off."
      >
        <LockedValue>Never allowed</LockedValue>
      </SettingRow>
    </SettingsCard>
  )
}

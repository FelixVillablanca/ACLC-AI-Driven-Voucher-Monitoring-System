import { CheckCircle2 } from 'lucide-react'
import Switch from '@/components/common/Switch'
import { KEYS } from '../utils'
import LockedValue from './LockedValue'
import MoneyInput from './MoneyInput'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * Approval rules: high-value threshold (₱), "Send AI-flagged vouchers to step 2" and the locked
 * segregation-of-duties rule. They're stored now; the voucher flow (Phases 3–4) reads them.
 *   field(key) → { id, value, edited, wasText, error, onChange }
 */
export default function ApprovalRulesCard({ field }) {
  const threshold = field(KEYS.THRESHOLD)
  const flagged = field(KEYS.AI_FLAGGED_STEP2)

  return (
    <SettingsCard
      id="approval"
      icon={CheckCircle2}
      title="Approval rules"
      caption="Decide when a voucher must go to the Supervisor / Manager (step 2)."
      notInUseYet="Approvals aren't built yet. These rules apply as soon as vouchers can be approved."
    >
      <SettingRow
        id={threshold.id}
        title="High-value threshold"
        caption="Vouchers at or above this amount always need step 2 approval."
        edited={threshold.edited}
        wasText={threshold.wasText}
        error={threshold.error}
      >
        <MoneyInput id={threshold.id} symbol="₱" value={threshold.value} onChange={threshold.onChange} invalid={Boolean(threshold.error)} />
      </SettingRow>

      <SettingRow
        id={flagged.id}
        title="Send AI-flagged vouchers to step 2"
        caption="Any voucher the anomaly check flags needs the Supervisor, whatever the amount."
        edited={flagged.edited}
        wasText={flagged.wasText}
      >
        <Switch id={flagged.id} checked={flagged.value} onChange={flagged.onChange} />
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

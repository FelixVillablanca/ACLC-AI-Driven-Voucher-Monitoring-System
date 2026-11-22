import { ChevronDown, Lock } from 'lucide-react'
import { inputClass } from '@/components/common/FieldShell'
import Switch from '@/components/common/Switch'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { FAILED_SIGN_IN_LIMITS, IDLE_MINUTES, KEYS } from '../utils'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * Security & sessions. All three are enforced today:
 *   idle sign-out for Super Admins (EnforceIdleTimeout), the failed sign-in alert (WatchSignIns),
 *   and "Require two-step for admins" (asks every Admin without it to set it up).
 */
export default function SecurityCard({ field, admins }) {
  const idle = field(KEYS.IDLE_TIMEOUT)
  const failed = field(KEYS.FAILED_SIGN_INS)
  const twoStep = field(KEYS.TWO_FACTOR_ADMINS)
  const missing = admins?.without_two_factor ?? 0

  return (
    <SettingsCard id="security" icon={Lock} tone="danger" title="Security & sessions" caption="Sign-in rules for the platform.">
      <SettingRow
        id={idle.id}
        title="Super Admins: sign out when idle after"
        caption="Other users stay signed in for the normal session time."
        edited={idle.edited}
        wasText={idle.wasText}
      >
        <Select id={idle.id} value={idle.value} onChange={idle.onChange} options={IDLE_MINUTES} unit="minutes" />
      </SettingRow>

      <SettingRow
        id={failed.id}
        title="Security alert after failed sign-ins"
        caption="Counted per account within 5 minutes. Creates a High security alert for you."
        edited={failed.edited}
        wasText={failed.wasText}
      >
        <Select id={failed.id} value={failed.value} onChange={failed.onChange} options={FAILED_SIGN_IN_LIMITS} unit="attempts" />
      </SettingRow>

      <SettingRow
        id={twoStep.id}
        title="Require two-step for admins"
        caption={
          missing === 0
            ? 'Every active Admin already uses two-step.'
            : `${plural(missing, 'admin hasn’t', 'admins haven’t')} set it up yet.`
        }
        edited={twoStep.edited}
        wasText={twoStep.wasText}
      >
        <Switch id={twoStep.id} checked={twoStep.value} onChange={twoStep.onChange} />
      </SettingRow>
    </SettingsCard>
  )
}

function Select({ id, value, onChange, options, unit }) {
  return (
    <div className="relative w-[150px]">
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={cn(inputClass, 'appearance-none pr-8')}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o} {unit}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}

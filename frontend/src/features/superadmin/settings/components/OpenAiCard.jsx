import { Wand2 } from 'lucide-react'
import Switch from '@/components/common/Switch'
import { formatUsd } from '@/lib/formatters'
import { KEYS } from '../utils'
import MoneyInput from './MoneyInput'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * OpenAI usage: what was spent this month (not tracked until report summaries exist, Phase 5),
 * the monthly cap ($) and "pause summaries at the cap".
 */
export default function OpenAiCard({ field, spent }) {
  const cap = field(KEYS.OPENAI_CAP)
  const pause = field(KEYS.OPENAI_PAUSE)

  return (
    <SettingsCard
      id="openai"
      icon={Wand2}
      title="OpenAI usage"
      caption="Report summaries. Only totals are sent, never voucher details."
      notInUseYet="AI report summaries aren't built yet, so nothing is sent to OpenAI and nothing is spent."
    >
      <div className="mx-5 mb-3.5 flex flex-col gap-2 rounded-[10px] bg-muted px-3.5 py-3">
        {spent == null ? (
          <>
            <p className="text-body-strong">Spending isn't tracked yet</p>
            <p className="text-caption">It's measured once AI report summaries exist.</p>
          </>
        ) : (
          <p className="text-body-strong">{formatUsd(spent)} used this month</p>
        )}
      </div>

      <SettingRow
        id={cap.id}
        title="Monthly spend cap"
        caption="The most OpenAI may cost in a month."
        edited={cap.edited}
        wasText={cap.wasText}
        error={cap.error}
      >
        <MoneyInput id={cap.id} symbol="$" value={cap.value} onChange={cap.onChange} invalid={Boolean(cap.error)} width={130} />
      </SettingRow>

      <SettingRow
        id={pause.id}
        title="Pause summaries at the cap"
        caption="Reports still build, just without the AI text."
        edited={pause.edited}
        wasText={pause.wasText}
      >
        <Switch id={pause.id} checked={pause.value} onChange={pause.onChange} />
      </SettingRow>
    </SettingsCard>
  )
}

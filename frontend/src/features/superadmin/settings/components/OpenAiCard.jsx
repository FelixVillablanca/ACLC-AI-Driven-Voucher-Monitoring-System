import { Wand2 } from 'lucide-react'
import Switch from '@/components/common/Switch'
import { formatUsd } from '@/lib/formatters'
import { KEYS } from '../utils'
import MoneyInput from './MoneyInput'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

/**
 * OpenAI usage: what report summaries cost this month (IN USE since 2026-11-27: the Accounting Officer's
 * financial reports), the monthly cap ($) and "pause summaries at the cap". The cap bar uses the saved cap.
 */
export default function OpenAiCard({ field, spent }) {
  const cap = field(KEYS.OPENAI_CAP)
  const pause = field(KEYS.OPENAI_PAUSE)
  const capValue = Number(String(cap.value ?? '').replace(/[^0-9.]/g, '')) || 0
  const pct = capValue > 0 ? Math.min(100, Math.round((Number(spent ?? 0) / capValue) * 100)) : 0

  return (
    <SettingsCard id="openai" icon={Wand2} title="OpenAI usage" caption="Report summaries. Only totals are sent, never voucher details.">
      <div className="mx-5 mb-3.5 flex flex-col gap-2 rounded-[10px] bg-muted px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-body-strong">{formatUsd(spent ?? 0)} used this month</p>
          <p className="text-caption">
            {pct}% of {formatUsd(capValue)}
          </p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-card"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="OpenAI spend this month"
        >
          <div
            className={pct >= 100 ? 'h-full bg-danger' : pct >= 80 ? 'h-full bg-warning' : 'h-full bg-primary'}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-caption">Counted from every report summary written this month, at OpenAI's list price.</p>
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

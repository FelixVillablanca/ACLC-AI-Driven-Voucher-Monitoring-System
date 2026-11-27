import { Sparkles } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { cn } from '@/lib/utils'
import { KEYS, SENSITIVITIES } from '../utils'
import LockedValue from './LockedValue'
import SettingRow from './SettingRow'
import SettingsCard from './SettingsCard'

const ML_PILL = {
  ok: { tone: 'success', text: '● ML service online' },
  danger: { tone: 'danger', text: '● ML service down' },
  not_configured: { tone: 'neutral', text: 'ML service not set up' },
}

/**
 * AI & anomaly detection: sensitivity (Relaxed / Balanced / Strict), the confidence a category
 * suggestion needs, and the locked "submit anyway, check later" fallback.
 * The ML service arrives in Phase 5; the pill shows whether it's reachable right now.
 */
export default function AiSettingsCard({ field, mlService }) {
  const sensitivity = field(KEYS.SENSITIVITY)
  const confidence = field(KEYS.MIN_CONFIDENCE)
  const pill = ML_PILL[mlService] ?? ML_PILL.not_configured
  const picked = SENSITIVITIES.find((s) => s.key === sensitivity.value)

  return (
    <SettingsCard
      id="ai"
      icon={Sparkles}
      tone="warning"
      title="AI & anomaly detection"
      caption="AI only gives advice. It never approves or rejects a voucher by itself."
      aside={<Pill tone={pill.tone}>{pill.text}</Pill>}
      notInUseYet="Anomaly sensitivity is already used by the automatic check (plain rules: flags at a score of 0.70 relaxed, 0.60 balanced, 0.45 strict). Category suggestions and the AI model come with the ML service."
    >
      <SettingRow
        id={sensitivity.id}
        title="Anomaly sensitivity"
        caption={picked?.hint ?? 'How unusual a voucher must be before it is flagged.'}
        edited={sensitivity.edited}
        wasText={sensitivity.wasText}
      >
        <div
          role="radiogroup"
          aria-labelledby={`${sensitivity.id}-label`}
          className="flex h-[38px] items-center gap-0.5 rounded-lg border bg-card p-[3px]"
        >
          <span id={`${sensitivity.id}-label`} className="sr-only">
            Anomaly sensitivity
          </span>
          {SENSITIVITIES.map((s) => {
            const on = sensitivity.value === s.key
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => sensitivity.onChange(s.key)}
                className={cn(
                  'h-full rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  on ? 'text-badge bg-primary-soft text-primary' : 'text-caption hover:text-foreground',
                )}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </SettingRow>

      <SettingRow
        id={confidence.id}
        title="Show category suggestions from"
        caption="Clerks only see an AI category suggestion when the AI is at least this sure."
        edited={confidence.edited}
        wasText={confidence.wasText}
      >
        <div className="flex w-60 max-w-full items-center gap-3">
          <input
            id={confidence.id}
            type="range"
            min={50}
            max={95}
            step={5}
            value={confidence.value}
            onChange={(e) => confidence.onChange(Number(e.target.value))}
            aria-valuetext={`${confidence.value}%`}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
          />
          <span className="text-body-strong flex h-8 w-14 items-center justify-center rounded-lg border bg-card" aria-hidden="true">
            {confidence.value}%
          </span>
        </div>
      </SettingRow>

      <SettingRow
        id="ml-down"
        title="If the ML service is down"
        caption="Vouchers still submit and show “AI check pending”. The check retries in the background."
      >
        <LockedValue>Submit anyway, check later</LockedValue>
      </SettingRow>
    </SettingsCard>
  )
}

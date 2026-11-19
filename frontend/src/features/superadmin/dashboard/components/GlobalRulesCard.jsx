import { Link } from 'react-router-dom'
import { PATHS } from '@/lib/constants'
import { formatMoney, formatTimeAgo, formatUsd } from '@/lib/formatters'
import { SENSITIVITY } from '../utils'

const SET_IT = 'Set it in Global settings'

/**
 * "Global rules" strip (Framer uH0wO9f5O): the platform-wide rules at a glance.
 * A rule nobody has saved yet shows "Not set" (we never invent a value).
 */
export default function GlobalRulesCard({ rules }) {
  const { last_change: lastChange, openai } = rules
  const sensitivity = SENSITIVITY[rules.anomaly_sensitivity]

  const changed = lastChange
    ? `last changed ${formatTimeAgo(lastChange.at)} by ${lastChange.by ?? 'the system'}`
    : 'not changed yet'

  return (
    <section aria-labelledby="rules-title" className="flex flex-col gap-3 rounded-xl border bg-card px-[18px] pt-4 pb-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 id="rules-title" className="text-card-title">
            Global rules
          </h2>
          <p className="text-caption">Apply to every company · {changed}</p>
        </div>
        <Link to={PATHS.SUPERADMIN_SETTINGS} className="text-auth-link text-primary hover:underline">
          Edit settings →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Rule
          label="High-value threshold"
          value={rules.high_value_threshold ? formatMoney(rules.high_value_threshold) : null}
          caption={rules.high_value_threshold ? 'Supervisor approval above this' : SET_IT}
        />
        <Rule
          label="AI anomaly sensitivity"
          value={sensitivity?.label}
          caption={sensitivity ? sensitivity.caption : SET_IT}
        />
        <OpenAiRule cap={openai.monthly_cap_usd} spent={openai.spent_this_month_usd} />
        <Rule
          label="Session timeout"
          value={`${rules.session_lifetime_minutes} minutes`}
          caption={`Super Admins: ${rules.super_admin_idle_timeout_minutes} minutes idle`}
        />
      </div>
    </section>
  )
}

function Rule({ label, value, caption, children }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] bg-muted px-3.5 py-3">
      <p className="text-caption">{label}</p>
      <p className={value ? 'text-body-strong' : 'text-body-strong text-muted-foreground'}>{value ?? 'Not set'}</p>
      {children}
      {caption && <p className="text-caption">{caption}</p>}
    </div>
  )
}

/** OpenAI spend: a progress bar once spending is tracked (it starts with the AI summaries, Phase 5). */
function OpenAiRule({ cap, spent }) {
  if (!cap) return <Rule label="OpenAI spend this month" value={null} caption="Set a monthly cap in Global settings" />

  if (spent === null || spent === undefined) {
    return <Rule label="OpenAI spend this month" value={`Cap ${formatUsd(cap)}`} caption="Spending is tracked once AI summaries start" />
  }

  const percent = Math.min(100, Math.round((Number(spent) / Number(cap)) * 100))
  return (
    <Rule label="OpenAI spend this month" value={`${formatUsd(spent)} of ${formatUsd(cap)}`}>
      <div
        role="progressbar"
        aria-label="OpenAI spend this month"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"
      >
        <div className={percent >= 80 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-primary'} style={{ width: `${percent}%` }} />
      </div>
    </Rule>
  )
}

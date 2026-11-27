import Pill from '@/components/common/Pill'
import { compactMoney } from '@/features/budgets'
import { RISK } from '../utils'

/** Over by ₱84k (red) · Tight · 93% (amber) · On track (green) · No budget set / Not enough history (grey). */
export default function RiskPill({ risk }) {
  const r = RISK[risk.level]
  const text = risk.level === 'over' ? `Over by ${compactMoney(risk.shortfall)}` : risk.level === 'tight' ? `Tight · ${risk.pct}%` : r.label
  return (
    <Pill tone={r.tone} className={risk.level === 'over' ? 'bg-danger text-white' : undefined}>
      {text}
    </Pill>
  )
}

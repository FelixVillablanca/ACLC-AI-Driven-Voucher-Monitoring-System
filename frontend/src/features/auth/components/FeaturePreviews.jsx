import { Check } from 'lucide-react'
import PreviewCard from './PreviewCard'

/**
 * The 4 floating preview cards (approved voucher, AI anomaly, budget, forecast).
 * Shown only on wide screens (xl = 1280px+), where there is room beside the form.
 * Positions/rotations are copied from the Framer frame; `order` = clockwise entrance order.
 */
const FORECAST_BARS = [22, 30, 26, 38, 44, 56] // px heights; the last one is "this month"

export default function FeaturePreviews() {
  return (
    <div className="hidden xl:block">
      {/* Voucher approved */}
      <PreviewCard className="flex w-[250px] items-center gap-3 p-3.5" top={150} left={64} rotate={-4} order={0}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-success-soft text-success">
          <Check className="size-4" strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <p className="text-body-strong">Voucher approved</p>
          <p className="text-caption">PCV-0412 · ₱48,250.00 · Level 2</p>
        </div>
      </PreviewCard>

      {/* AI anomaly flagged */}
      <PreviewCard className="flex w-[260px] flex-col gap-2.5 p-3.5" top={468} left={104} rotate={3} order={3}>
        <div className="flex items-center gap-2.5">
          <div className="text-badge flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-warning-soft text-warning">
            !
          </div>
          <p className="text-body-strong flex-1">AI anomaly flagged</p>
          <span className="text-badge rounded-full bg-warning-soft px-2 py-0.5 text-warning">0.87</span>
        </div>
        <p className="text-caption">Amount is 3.2× above the Logistics department average. Routed to Supervisor.</p>
      </PreviewCard>

      {/* Budget used */}
      <PreviewCard className="flex w-[250px] flex-col gap-2 p-4" top={164} left={884} rotate={3} order={1}>
        <div className="flex items-center justify-between">
          <p className="text-caption">Budget used · FY 2026</p>
          <span className="text-badge rounded-full bg-primary-soft px-2 py-0.5 text-primary">FIN-OPS</span>
        </div>
        <p className="text-stat-value">72%</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
          <div className="h-full w-[72%] rounded-full bg-primary" />
        </div>
        <p className="text-caption">₱1.44M of ₱2.00M allocated</p>
      </PreviewCard>

      {/* December forecast */}
      <PreviewCard className="flex w-[260px] flex-col gap-3 p-4" top={470} left={852} rotate={-3} order={2}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-caption">December forecast</p>
            <p className="text-card-title">₱612,400</p>
          </div>
          <span className="text-badge rounded-full bg-success-soft px-2 py-0.5 text-success">91% conf.</span>
        </div>
        <div className="flex h-14 items-end gap-2">
          {FORECAST_BARS.map((height, i) => (
            <div
              key={i}
              className={`flex-1 rounded ${i === FORECAST_BARS.length - 1 ? 'bg-primary' : 'bg-primary-soft'}`}
              style={{ height }}
            />
          ))}
        </div>
      </PreviewCard>
    </div>
  )
}

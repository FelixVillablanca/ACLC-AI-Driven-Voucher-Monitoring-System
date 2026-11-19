/**
 * Compact KPI tile (Framer uH0wO9f5O): big number on the left, label + caption beside it.
 *   <KpiTile value="2/3" label="Super admins" caption="1 seat left" />
 */
export default function KpiTile({ value, label, caption }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border bg-card px-[18px] py-4">
      <p className="text-stat-value shrink-0">{value}</p>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-strong truncate">{label}</p>
        <p className="text-caption truncate">{caption}</p>
      </div>
    </div>
  )
}

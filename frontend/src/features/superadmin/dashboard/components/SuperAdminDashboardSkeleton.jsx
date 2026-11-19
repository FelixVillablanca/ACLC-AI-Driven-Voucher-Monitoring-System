/**
 * LOADING STATE: grey blocks in the same shape as the real page
 * (banner, 4 KPI tiles, attention + admins, rules), so nothing jumps when data arrives.
 */
function Block({ className }) {
  return <div className={`animate-pulse rounded-md bg-border/70 ${className}`} />
}

export default function SuperAdminDashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading the Super Admin overview" className="flex flex-col gap-5">
      <div className="flex flex-col gap-6 rounded-[14px] border border-primary-soft bg-primary-faint px-6 py-[22px] lg:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <Block className="h-3 w-40" />
          <Block className="h-7 w-56" />
          <Block className="h-4 w-full max-w-md" />
          <div className="flex gap-2.5">
            <Block className="h-[38px] w-28 rounded-lg" />
            <Block className="h-[38px] w-44 rounded-lg" />
          </div>
        </div>
        <Block className="h-40 w-full rounded-xl lg:w-[320px]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} className="h-[74px] rounded-xl" />
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-xl border bg-card p-[18px]">
          <Block className="mb-4 h-5 w-48" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Block className="size-8 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Block className="h-4 w-2/3" />
                <Block className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <Block className="h-72 w-full rounded-xl lg:w-[360px]" />
      </div>

      <Block className="h-36 rounded-xl" />
    </div>
  )
}

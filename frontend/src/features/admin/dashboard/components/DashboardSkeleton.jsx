/**
 * LOADING STATE: grey placeholder blocks in the same shape as the real
 * dashboard, so the page doesn't "jump" when the data arrives.
 */
function Block({ className }) {
  return <div className={`animate-pulse rounded-md bg-border/70 ${className}`} />
}

export default function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]">
            <div className="flex items-center justify-between">
              <Block className="h-4 w-24" />
              <Block className="size-8 rounded-lg" />
            </div>
            <Block className="h-8 w-14" />
            <Block className="h-5 w-32" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-xl border bg-card p-[18px]">
          <Block className="mb-5 h-5 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Block className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Block className="h-4 w-2/3" />
                <Block className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-[300px]">
          <Block className="h-48 rounded-xl" />
          <Block className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Grey placeholder shaped like an alert card, shown while the list loads. */
export default function AlertCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2.5 rounded-xl border bg-card px-4 py-3.5" aria-hidden="true">
      <div className="flex justify-between">
        <div className="h-5 w-32 rounded-full bg-border/70" />
        <div className="h-3 w-14 rounded bg-border/70" />
      </div>
      <div className="h-4 w-3/5 rounded bg-border/70" />
      <div className="h-3 w-4/5 rounded bg-border/70" />
      <div className="flex gap-2 pt-1">
        <div className="h-8 w-16 rounded-lg bg-border/70" />
        <div className="h-8 w-16 rounded-lg bg-border/70" />
      </div>
    </div>
  )
}

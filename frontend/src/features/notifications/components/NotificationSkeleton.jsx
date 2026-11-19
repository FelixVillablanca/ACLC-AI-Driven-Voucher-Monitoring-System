/** LOADING STATE for the panel: grey rows shaped like notifications. */
export default function NotificationSkeleton() {
  return (
    <div role="status" aria-label="Loading notifications">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
          <div className="size-[34px] shrink-0 animate-pulse rounded-full bg-border/70" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-border/70" />
            <div className="h-3 w-full animate-pulse rounded bg-border/70" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-border/70" />
          </div>
        </div>
      ))}
    </div>
  )
}

import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shown when loading failed. Always offers a way forward (Retry),
 * and shows the tracking number so a bug report can be traced.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again.',
  requestId,
  onRetry,
  className,
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 p-10 text-center', className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="size-5 text-danger" aria-hidden="true" />
      </div>
      <div>
        <p className="text-card-title">{title}</p>
        <p className="text-caption mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden="true" /> Try again
        </Button>
      )}
      {requestId && <p className="text-caption">Reference: {requestId}</p>}
    </div>
  )
}

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shown while data is loading. */
export default function LoadingState({ label = 'Loading…', className }) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center gap-3 p-10 text-center', className)}>
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-caption">{label}</p>
    </div>
  )
}

import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shown when loading worked but there is nothing to show yet. */
export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 p-10 text-center', className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-primary-soft">
        <Icon className="size-5 text-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="text-card-title">{title}</p>
        {description && <p className="text-caption mt-1 max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
